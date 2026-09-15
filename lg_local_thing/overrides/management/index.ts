// LG Local Thing: authenticated HA room management, 2026-09-14. GPL v2.
import { WebSocketExpress, ExtendedWebSocket } from 'websocket-express'

import path from 'path'
import { fileURLToPath } from 'url'
import log from '@/util/logging'

import HA_bridge from '@/cloud/ha_bridge'
import { AnyDevice, DeviceManager } from '@/cloud/devmgr'
import { Bridge } from '@/bridge'
import { Request, Response } from 'express'
import { Device as T1Device } from '@/cloud/thinq1/device'
import { Device as T2Device } from '@/cloud/thinq2/device'
import { friendlyNames } from '@/util/friendly-names'
import { HomeAssistantAreas, isIngressAddress } from '@/util/ha-areas'

// refresh bridged device names policy:
// - only if a websocket subscriber is connected
// - on the first subscriber's connection (but no more often than 1/minute)
// - every 15 minutes
const BRIDGE_REFRESH_NAMES_PERIOD = 1000 * 60 * 15
const BRIDGE_REFRESH_NAMES_COOLOFF = 1000 * 60

export function app(ha: HA_bridge, manager: DeviceManager, bridge: Bridge | undefined) {
    const app = new WebSocketExpress()
    const subscribers = new Set<ExtendedWebSocket>()
    const deviceMonitors = new Map<ExtendedWebSocket, () => void>()
    const disposers: Array<() => void> = []
    let shuttingDown = false
    const areas = new HomeAssistantAreas()
    let syncingAreas = false
    const savingDevices = new Set<string>()
    async function syncAreas() {
        if (syncingAreas || shuttingDown || !process.env.SUPERVISOR_TOKEN) return
        syncingAreas = true
        try {
            for (const [id, identity] of friendlyNames.pending()) {
                if (shuttingDown) break
                if (savingDevices.has(id) || identity.areaId === undefined) continue
                try {
                    if (await areas.assign(id, identity.areaId)) {
                        friendlyNames.markAreaSynced(id, identity.areaId)
                        refreshDevices()
                    }
                } catch { /* Keep pending for the next discovery / retry. No credentials in logs. */ }
            }
        } finally { syncingAreas = false }
    }
    const areaTimer = setInterval(() => void syncAreas(), 30000)
    areaTimer.unref()
    disposers.push(() => clearInterval(areaTimer))

    function closeQuietly(ws: ExtendedWebSocket) {
        try {
            ws.close()
        } catch {}
    }

    function safeSend(ws: ExtendedWebSocket, message: string) {
        if (ws.readyState !== ws.OPEN) return false
        try {
            ws.send(message, (error) => {
                if (error) {
                    subscribers.delete(ws)
                    closeQuietly(ws)
                }
            })
            return true
        } catch {
            subscribers.delete(ws)
            closeQuietly(ws)
            return false
        }
    }

    // Room operations require the authenticated Supervisor ingress peer, not forwarded headers.
    function requireIngress(req: Request, res: Response): boolean {
        if (!isIngressAddress(req.socket.remoteAddress) || req.get('sec-fetch-site') === 'cross-site') {
            res.status(403).end('Abra a interface pelo Home Assistant para configurar cômodos.')
            return false
        }
        return true
    }

    // device management
    function broadcast(message: object) {
        const str = JSON.stringify(message)
        subscribers.forEach((sub) => safeSend(sub, str))
    }

    function statusReport(message: string) {
        broadcast({ status: message })
    }

    app.use(function (req, res, next) {
        log('MGMT', req.hostname, req.url)
        next()
    })
    app.use(WebSocketExpress.json())

    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    app.ws('/ws', (req, res, next) => {
        res.accept().then((ws) => {
            if (shuttingDown) {
                closeQuietly(ws)
                return
            }

            if (subscribers.size === 0) firstSubscriberConnected()

            subscribers.add(ws)

            safeSend(
                ws,
                JSON.stringify({
                    ha: ha.HA.isConnected,
                    bridge: bridgeStatus(),
                    devices: enumDevices(),
                }),
            )

            ws.on('message', (msg) => {})

            ws.on('close', () => {
                subscribers.delete(ws)
                if (subscribers.size === 0) lastSubscriberDisconnected()
            })
        }, next)
    })

    const onHaStatusChanged = (ha: boolean) => {
        broadcast({ ha })
    }
    ha.HA.on('statusChanged', onHaStatusChanged)
    disposers.push(() => ha.HA.removeListener('statusChanged', onHaStatusChanged))

    function enumDevices() {
        const allDevices: Record<string, any> = {}
        for (const id in manager.allDevices) {
            const dev = manager.allDevices[id]
            const meta = dev.meta
            const identity = friendlyNames.get(id)

            allDevices[id] = {
                // Smart House local name is authoritative. The cloud name, when available,
                // is exposed only as a suggestion and never controls Home Assistant identity.
                name: identity?.name,
                entityBase: identity?.entityBase,
                room: identity?.room,
                areaId: identity?.areaId,
                areaPending: identity?.areaPending,
                cloudName: bridge?.name(id),
                model: meta.modelId,
                deviceType: meta.deviceType,
                platform: dev.platform,
                mapped: ha.haDevices.has(id),
                bridged: bridge ? bridge.status(id) : false,
            }
        }
        return allDevices
    }

    function refreshDevices() {
        broadcast({ devices: enumDevices() })
    }

    function onNewDevice(dev: AnyDevice) {
        refreshDevices()
        void syncAreas()
    }

    /*
     * Smart House local friendly-name management.
     *
     * First save:
     *   "Ar Casal" -> entityBase "ar_casal"
     *
     * Later rename:
     *   "Ar Suite" -> entityBase remains "ar_casal"
     *
     * Saving also republishes this device's MQTT Discovery configuration.
     * The HA-side unique_id remains based on the physical device id.
     */
    app.get('/areas', asyncHandler(async (req, res) => {
        if (!requireIngress(req, res)) return
        try { res.json(await areas.list()) }
        catch { res.status(503).end('Não foi possível carregar os cômodos do Home Assistant. Tente novamente.') }
    }))

    app.post(
        '/device/:deviceId/name',
        asyncHandler(async (req, res) => {
            const id = req.params.deviceId
            const dev = manager.allDevices[id]

            if (!dev) {
                res.status(404).end('Unknown device')
                return
            }

            if (typeof req.body?.name !== 'string') {
                res.status(400).end('Field "name" must be a string')
                return
            }

            const hasArea = Object.prototype.hasOwnProperty.call(req.body, 'areaId')
            if ((hasArea || req.body.newArea !== undefined) && !requireIngress(req, res)) return
            if (!req.body.name.trim() || req.body.name.trim().length > 80) {
                res.status(400).end('Informe um nome entre 1 e 80 caracteres.')
                return
            }
            if (savingDevices.has(id) || syncingAreas) {
                res.status(409).end('Sincronização em andamento. Tente novamente em instantes.')
                return
            }
            savingDevices.add(id)
            try {
                const area = hasArea ? await areas.resolve(req.body.areaId, req.body.newArea) : undefined
                const identity = friendlyNames.set(id, req.body.name, area)

                /*
                 * If the model is supported, this is the moment the first
                 * Discovery packet is allowed through. On subsequent saves
                 * it republishes the same unique_ids/default entity IDs with
                 * only the user-facing device name changed.
                 */
                ha.haDevices.get(id)?.publishConfig()

                refreshDevices()

                res.json(identity)
                setTimeout(() => void syncAreas(), 1000).unref()
            } catch (err) {
                res.status(400).end(err instanceof Error ? err.message : 'Falha ao salvar.')
            } finally { savingDevices.delete(id) }
        }),
    )

    manager.on('newDevice', onNewDevice)
    manager.on('dropDevice', refreshDevices)
    disposers.push(() => {
        manager.removeListener('newDevice', onNewDevice)
        manager.removeListener('dropDevice', refreshDevices)
    })

    if (bridge) {
        app.get(
            '/thinq_login',
            asyncHandler(async (req, res) => {
                res.redirect((await bridge.beginLogin({ countryCode: req.query.countryCode as string })).toString())
            }),
        )

        app.post(
            '/thinq_login_accept',
            asyncHandler(async (req, res) => {
                const url = `${req.body.url}`
                const countryCode = `${req.body.countryCode}`
                if (await bridge.completeLogin({ countryCode }, new URL(url))) {
                    res.statusCode = 200
                    res.end()
                } else {
                    res.statusCode = 400
                    res.end()
                }
            }),
        )

        app.post(
            '/thinq_logout',
            asyncHandler(async (req, res) => {
                await bridge.logout()
                res.end()
            }),
        )

        app.post(
            '/bridge/:deviceId/enable',
            asyncHandler(async (req, res) => {
                const deviceType = typeof req.body.deviceType === 'string' ? (req.body.deviceType as string) : undefined
                try {
                    if (await bridge.enable(req.params.deviceId, deviceType, statusReport)) res.status(204).end()
                    else res.status(400).end()
                } catch (err) {
                    res.status(500).end(`${err}`)
                }
            }),
        )

        app.get(
            '/bridge/:deviceId/modeljson',
            asyncHandler(async (req, res) => {
                try {
                    const { modelName, modelJson } = await bridge.getModelJson(req.params.deviceId)
                    // the model name comes from the device, don't let it break out of the header
                    const fileName = modelName.replace(/[^A-Za-z0-9._-]/g, '_') || 'model'
                    res.setHeader('Content-Type', 'application/json')
                    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.json"`)
                    res.end(modelJson)
                } catch (err) {
                    res.status(500).end(`${err}`)
                }
            }),
        )

        app.post(
            '/bridge/:deviceId/disable',
            asyncHandler(async (req, res) => {
                await bridge.disable(req.params.deviceId)
                res.status(204).end()
            }),
        )

        function refreshBridgeStatus() {
            broadcast({ bridge: bridgeStatus() })
        }

        bridge.on('loggedIn', refreshBridgeStatus)
        bridge.on('loggedOut', refreshBridgeStatus)
        bridge.on('started', refreshDevices)
        bridge.on('stopped', refreshDevices)
        bridge.on('namesChanged', refreshDevices)
        disposers.push(() => {
            bridge.removeListener('loggedIn', refreshBridgeStatus)
            bridge.removeListener('loggedOut', refreshBridgeStatus)
            bridge.removeListener('started', refreshDevices)
            bridge.removeListener('stopped', refreshDevices)
            bridge.removeListener('namesChanged', refreshDevices)
        })
    }

    function bridgeStatus() {
        if (bridge) return { loggedIn: bridge.isLoggedIn() }
    }

    let refreshNamesTimer: ReturnType<typeof setInterval> | undefined
    let lastNamesRefresh: number | undefined

    // device name list refresh
    function firstSubscriberConnected() {
        function maybeRefreshNames() {
            const now = Date.now()
            if (lastNamesRefresh && now - lastNamesRefresh < BRIDGE_REFRESH_NAMES_COOLOFF) return

            void bridge?.refreshNames()
            lastNamesRefresh = Date.now()
        }

        if (bridge) {
            maybeRefreshNames()
            refreshNamesTimer = setInterval(() => maybeRefreshNames(), BRIDGE_REFRESH_NAMES_PERIOD)
        }
    }

    function lastSubscriberDisconnected() {
        if (refreshNamesTimer) clearInterval(refreshNamesTimer)
        refreshNamesTimer = undefined
    }

    // device monitoring
    app.ws('/device', (req, res, next) => {
        const id = req.query?.id
        if (typeof id !== 'string') {
            res.status(400).end()
            return
        }

        res.accept().then((ws) => {
            if (shuttingDown) {
                closeQuietly(ws)
                return
            }
            let injectFlag = false
            let device: AnyDevice | undefined
            const onDeviceRx = (arg: Buffer) => {
                safeSend(ws, JSON.stringify({ rx: arg.toString('hex'), injected: injectFlag }))
            }

            const onDeviceTx = (arg: Buffer | object) => {
                if (Buffer.isBuffer(arg))
                    safeSend(ws, JSON.stringify({ tx: arg.toString('hex'), injected: injectFlag }))
                else safeSend(ws, JSON.stringify({ tx: JSON.stringify(arg), injected: injectFlag }))
            }

            const checkDevicePresence = () => {
                const dev = manager.allDevices[id]

                if (dev !== device) {
                    device?.removeListener('data', onDeviceRx)
                    device?.removeListener('sendData', onDeviceTx)

                    device = dev
                    if (device) {
                        safeSend(ws, JSON.stringify({ status: 'online', meta: device.meta }))
                        device.on('data', onDeviceRx)
                        device.on('sendData', onDeviceTx)
                    } else {
                        safeSend(ws, JSON.stringify({ status: 'offline' }))
                    }
                }
            }

            manager.on('newDevice', checkDevicePresence)
            manager.on('dropDevice', checkDevicePresence)

            checkDevicePresence()

            ws.on('message', (msg) => {
                if (!Buffer.isBuffer(msg)) return

                let json: any
                try {
                    json = JSON.parse(msg.toString('utf-8'))
                } catch {
                    return
                }
                const dev = manager.allDevices[id]

                try {
                    if (typeof json.sendToDevice === 'object' && dev && dev instanceof T1Device) {
                        try {
                            injectFlag = true
                            dev.send(json.sendToDevice)
                        } finally {
                            injectFlag = false
                        }
                    }

                    if (typeof json.sendToDevice === 'string' && dev && dev instanceof T2Device) {
                        try {
                            injectFlag = true
                            dev.send_packet(Buffer.from(json.sendToDevice, 'hex'))
                        } finally {
                            injectFlag = false
                        }
                    }

                    if (json.sendFromDevice && dev) {
                        try {
                            injectFlag = true
                            dev.emit('data', Buffer.from(json.sendFromDevice, 'hex'))
                        } finally {
                            injectFlag = false
                        }
                    }
                } catch (err) {
                    log('MGMT', id, `inject error: ${err}`)
                }
            })

            const cleanup = () => {
                if (!deviceMonitors.delete(ws)) return
                device?.removeListener('data', onDeviceRx)
                device?.removeListener('sendData', onDeviceTx)
                device = undefined
                manager.removeListener('newDevice', checkDevicePresence)
                manager.removeListener('dropDevice', checkDevicePresence)
            }
            deviceMonitors.set(ws, cleanup)
            ws.once('close', cleanup)
            ws.once('error', cleanup)
        }, next)
    })

    // static pages
    app.use(WebSocketExpress.static(currentDir + '/../html', { extensions: ['html'] }))
    const server = app.createServer()

    const dispose = () => {
        if (shuttingDown) return
        shuttingDown = true
        for (const dispose of disposers.splice(0)) dispose()
        for (const subscriber of subscribers) closeQuietly(subscriber)
        subscribers.clear()
        for (const [monitor, cleanup] of deviceMonitors) {
            cleanup()
            closeQuietly(monitor)
        }
        deviceMonitors.clear()
        lastSubscriberDisconnected()
    }

    const close = server.close.bind(server)
    server.close = ((callback?: (err?: Error) => void) => {
        dispose()
        return close(callback)
    }) as typeof server.close
    server.once('close', dispose)
    return server
}

function asyncHandler(handler: (req: Request, res: Response) => Promise<any>) {
    return (req: Request, res: Response, next: (err: any) => void) => {
        handler(req, res).catch(next)
    }
}
