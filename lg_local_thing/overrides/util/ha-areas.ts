// LG Local Thing / Smart House — area assignment, 2026-09-14. GPL v2.
import WebSocket from 'ws'

export type Area = { area_id: string; name: string }
type RegistryDevice = { id: string; identifiers: string[][]; area_id: string | null }

/** One short-lived authenticated connection per operation. Never expose the token to the UI. */
export class HomeAssistantAreas {
    constructor(
        private readonly url = 'ws://supervisor/core/websocket',
        private readonly token = process.env.SUPERVISOR_TOKEN,
    ) {}

    private async session<T>(operation: (call: (type: string, fields?: object) => Promise<any>) => Promise<T>): Promise<T> {
        if (!this.token) throw new Error('Abra pelo Home Assistant e atualize o add-on para habilitar o acesso aos cômodos.')
        const ws = new WebSocket(this.url)
        let sequence = 0
        const pending = new Map<number, { resolve: (data: any) => void; reject: (error: Error) => void }>()
        let authResolve!: () => void
        let authReject!: (error: Error) => void
        const ready = new Promise<void>((resolve, reject) => { authResolve = resolve; authReject = reject })
        const fail = (message: string) => {
            const error = new Error(message)
            authReject(error)
            for (const request of pending.values()) request.reject(error)
            pending.clear()
        }
        const timer = setTimeout(() => {
            fail('O Home Assistant não respondeu. Tente novamente.')
            ws.terminate()
        }, 10000)
        ws.on('error', () => fail('Não foi possível conectar ao Home Assistant.'))
        ws.on('close', () => fail('A conexão com o Home Assistant foi encerrada.'))
        ws.on('message', (raw) => {
            try {
                const message = JSON.parse(raw.toString())
                if (message.type === 'auth_required') ws.send(JSON.stringify({ type: 'auth', access_token: this.token }))
                else if (message.type === 'auth_ok') authResolve()
                else if (message.type === 'auth_invalid') fail('Home Assistant recusou a autorização do add-on.')
                else if (message.type === 'result') {
                    const request = pending.get(message.id)
                    if (!request) return
                    pending.delete(message.id)
                    if (message.success) request.resolve(message.result)
                    else request.reject(new Error('Home Assistant recusou a operação de cômodo. Atualize a lista e tente novamente.'))
                }
            } catch { fail('Resposta inválida do Home Assistant.') }
        })
        const call = (type: string, fields: object = {}) => new Promise<any>((resolve, reject) => {
            const id = ++sequence
            pending.set(id, { resolve, reject })
            ws.send(JSON.stringify({ ...fields, id, type }), (error) => {
                if (error) { pending.delete(id); reject(new Error('Falha ao enviar a operação ao Home Assistant.')) }
            })
        })
        try { await ready; return await operation(call) }
        finally { clearTimeout(timer); ws.close() }
    }

    list(): Promise<Area[]> {
        return this.session((call) => call('config/area_registry/list'))
    }

    async resolve(areaId: unknown, newName?: unknown): Promise<{ areaId: string | null; room: string }> {
        if (newName !== undefined && (typeof newName !== 'string' || !newName.trim() || newName.trim().length > 80))
            throw new Error('Informe um nome de cômodo entre 1 e 80 caracteres.')
        if (areaId !== null && typeof areaId !== 'string') throw new Error('Selecione um cômodo válido.')
        if (newName && areaId !== null) throw new Error('Selecione um cômodo existente ou crie um novo.')
        return this.session(async (call) => {
            const areas: Area[] = await call('config/area_registry/list')
            if (typeof newName === 'string') {
                const name = newName.trim()
                const existing = areas.find((a) => a.name.toLocaleLowerCase() === name.toLocaleLowerCase())
                const area: Area = existing ?? await call('config/area_registry/create', { name })
                return { areaId: area.area_id, room: area.name }
            }
            if (areaId === null) return { areaId: null, room: '' }
            const area = areas.find((a) => a.area_id === areaId)
            if (!area) throw new Error('O cômodo não existe mais. Atualize a lista.')
            return { areaId: area.area_id, room: area.name }
        })
    }

    /** Match the exact MQTT identifier, never a display name or a partial match. */
    assign(identifier: string, areaId: string | null): Promise<boolean> {
        return this.session(async (call) => {
            const devices: RegistryDevice[] = await call('config/device_registry/list')
            const matches = devices.filter((d) => d.identifiers?.some(([domain, id]) => domain === 'mqtt' && id === identifier))
            if (matches.length !== 1) return false
            if (matches[0].area_id !== areaId)
                await call('config/device_registry/update', { device_id: matches[0].id, area_id: areaId })
            return true
        })
    }
}

export function isIngressAddress(address?: string): boolean {
    return address === '172.30.32.2' || address === '::ffff:172.30.32.2'
}
