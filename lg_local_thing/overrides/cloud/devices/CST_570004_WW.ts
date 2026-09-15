// Smart House, 2026-09-15. Experimental AMNW24GTBA0 support, derived from ReThink. GPL v2.
import RAC from './RAC_056905_WW'
import type { DeviceDiscovery } from '../homeassistant'
import type { FieldDefinition } from './tlv_device'
import type { TLV } from '../../util/tlv'

const fans: Record<string, number> = { '1': 1, '2': 2, '4': 4, '6': 6, 'Força': 7, auto: 8 }
const core = [0x1f7, 0x1f9, 0x1fa, 0x1fd, 0x1fe]
const airflow: Record<string, number> = {
    'Circular': 0x205, 'Fluxo de ar indireto': 0x28e, 'Fluxo de ar direto': 0x28f,
    'Modo Smart': 0x290, 'Modo de atualização': 0x291, 'Agitar': 0x325,
}
const positions = ['Padr.', '1', '2', '3', '4', '5', '6']
const modes: Record<string, number> = {cool: 0, dry: 1, fan_only: 2, heat: 4, auto: 6}

export default class Device extends RAC {
    override isValuesResponse(values: TLV[]) {
        return core.every(id => values.some(v => v.t === id))
    }

    override processTLV(values: TLV[]) {
        const hadConfig = !!this.config
        const capabilitiesChanged = values.some(({t,v}) => t >= 0x2c0 && t <= 0x2ef && this.raw_clip_state[t] !== v)
        const newVaneFields = values.some(({t}) => [0x321, ...Object.values(airflow)].includes(t) && this.raw_clip_state[t] === undefined)
        super.processTLV(values)
        // Real captures contain five state fields, not the RAC minimum of ten.
        // Basic discovery must also work when the RAC EEPROM capability tag is absent.
        if (!this.initialValuesReceived && this.isValuesResponse(values)) {
            clearInterval(this.query_caps_timeout)
            this.query_caps_timeout = undefined
            clearInterval(this.query_values_timeout)
            this.query_values_timeout = undefined
            this.valuesReceived()
        } else if (hadConfig && (capabilitiesChanged || newVaneFields)) {
            this.initMakeSetConfig()
        }
        // Publish compound state only after the whole response has been applied.
        this.publishAirflow()
    }

    override valuesReceived() {
        if (this.initialValuesReceived) return
        this.initialValuesReceived = true
        this.initMakeSetConfig()
    }

    override initMakeSetConfig() {
        this.fields_by_id = {}
        this.fields_by_ha = {}
        this.powerChangeHooks = []
        this.modeChangeHooks = []
        // No RAC-specific filter probing or energy calibration for this cassette.
        super.initMakeSetConfig()
        for (const [key,value] of Object.entries(this.raw_clip_state)) this.processKeyValue(Number(key), value)
    }

    override addField(config: DeviceDiscovery, field: FieldDefinition, autoreg?: boolean) {
        if (field.comp === 'energy_current' || field.id === 0x321 || field.id === 0x322) return
        if (field.id === 0x1fa) field = {
            ...field,
            read_xform: value => Object.keys(fans).find(key => fans[key] === value),
            write_xform: value => fans[value],
        }
        super.addField(config, field, autoreg)
    }

    override setConfig(config: DeviceDiscovery) {
        const climate = config.components.climate as any
        climate.fan_modes = Object.keys(fans)
        // Mode values confirmed by LG ThinQ commands and device responses.
        climate.modes = ['off', 'cool', 'dry', 'fan_only', 'heat', 'auto']
        climate.temp_step = 1
        delete config.components.energy_current
        for (const key of Object.keys(climate)) if (key.startsWith('swing_')) delete climate[key]
        if (this.raw_clip_state[0x321] !== undefined) {
            climate.swing_modes = ['off', 'on', ...positions]
            this.addField(config, {comp:'climate', name:'swing_mode'})
        }
        const available = Object.entries(airflow).filter(([,id]) => this.raw_clip_state[id] !== undefined)
        if (available.length) {
            config.components.airflow = {
                platform: 'select', unique_id: '$deviceid-airflow', name: 'Fluxo de ar',
                icon: 'mdi:air-filter', options: ['Desligado', ...available.map(([name]) => name)],
            } as any
            this.addField(config, {comp:'airflow', name:''})
        }
        super.setConfig(config)
    }

    publishAirflow() {
        if (!this.config) return
        const active = Object.entries(airflow).find(([,id]) => this.raw_clip_state[id] === 1)
        if (this.config.components.airflow) this.HA.publishProperty(this.id, 'airflow-', active?.[0] ?? 'Desligado')
        const packed = this.raw_clip_state[0x321]
        const position = positions.find((_, index) => packed === index * 0x1111)
        if (this.fields_by_ha['climate-swing_mode']) {
            const state = this.raw_clip_state[0x205] === 1 ? 'on' : position
            if (state !== undefined) this.HA.publishProperty(this.id, 'climate-swing_mode', state)
        }
    }

    writeCaptured(values: TLV[]) {
        // LG ThinQ uses sequence byte 0. State is updated by the device response only.
        this.send([1, 1, 2, 1, 0], values)
    }

    setAirflow(value: string) {
        if (value === 'Desligado') {
            for (const id of Object.values(airflow)) {
                if (this.raw_clip_state[id] === 1) this.writeCaptured([{t:id, v:0}])
            }
        } else if (Object.prototype.hasOwnProperty.call(airflow, value) && this.raw_clip_state[airflow[value]] !== undefined) {
            // Firmware handles mutual exclusion and any climate side effects.
            this.writeCaptured([{t:airflow[value], v:1}])
        }
    }

    override setProperty(prop: string, value: string) {
        const field = this.fields_by_ha[prop]
        if (!field || field.writable === false) return
        if (prop === 'airflow-') { this.setAirflow(value); return }
        if (prop === 'climate-swing_mode') {
            if (value === 'on') this.setAirflow('Circular')
            else if (value === 'off') this.setAirflow('Desligado')
            else if (positions.includes(value)) this.writeCaptured([{t:0x321, v:positions.indexOf(value) * 0x1111}])
            return
        }
        if (prop === 'climate-fan_mode' && !Object.prototype.hasOwnProperty.call(fans, value)) return
        if (prop === 'climate-mode' && !['off','cool','dry','fan_only','heat','auto'].includes(value)) return
        if (prop === 'climate-power' && !['ON','OFF'].includes(value)) return
        if (prop === 'climate-temperature' && (!value.trim() || !Number.isFinite(Number(value)) || Number(value) < 18 || Number(value) > 30 || !Number.isInteger(Number(value)))) return
        const component = this.config?.components[field.comp] as any
        if (component?.platform === 'number' && (!value.trim() || !Number.isFinite(Number(value)) || Number(value) < component.min || Number(value) > component.max)) return
        if (component?.platform === 'switch' && !['ON','OFF'].includes(value)) return
        if (prop === 'climate-swing_mode' && !component?.swing_modes?.includes(value)) return
        if (prop === 'climate-swing_horizontal_mode' && !component?.swing_horizontal_modes?.includes(value)) return
        if (Array.isArray(field.write_attach) && field.write_attach.some(id => this.raw_clip_state[id] === undefined)) return
        if (prop === 'climate-power') {
            // Power-only ON was physically confirmed on AMNW24GTBA0 on 2026-09-15.
            this.raw_clip_state[0x1f7] = value === 'ON' ? 1 : 0
            this.send([1, 1, 2, 1, 1], [{t: 0x1f7, v: this.raw_clip_state[0x1f7]}])
            return
        }
        if (['climate-temperature','climate-fan_mode','climate-mode'].includes(prop)) {
            if (prop === 'climate-mode' && value === 'off') { this.setProperty('climate-power','OFF'); return }
            let mode = prop === 'climate-mode' ? modes[value] : this.getModeTLV()
            let fan = prop === 'climate-fan_mode' ? fans[value] : this.raw_clip_state[0x1fa]
            let target = prop === 'climate-temperature' ? Number(value)*2 : this.raw_clip_state[0x1fe]
            if (![mode,fan,target].every(Number.isFinite)) return
            if (prop === 'climate-fan_mode' && value === 'Força') {
                if (mode !== 0 || this.getPowerTLV() !== 1) return // captured in cooling only
                target = 36
            }
            const turningOn = prop === 'climate-mode' && this.getPowerTLV() === 0
            if (turningOn && mode === this.getModeTLV()) { this.setProperty('climate-power','ON'); return }
            this.writeCaptured([{t:0x1f9,v:mode},{t:0x1fa,v:fan},{t:0x1fe,v:target}])
            if (turningOn) this.setProperty('climate-power','ON')
            return
        }
        super.setProperty(prop, value)
    }
}
