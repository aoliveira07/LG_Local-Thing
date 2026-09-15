// Smart House, 2026-09-15. Experimental AMNW24GTBA0 support, derived from ReThink. GPL v2.
import RAC from './RAC_056905_WW'
import type { DeviceDiscovery } from '../homeassistant'
import type { FieldDefinition } from './tlv_device'
import type { TLV } from '../../util/tlv'

const fans: Record<string, number> = { '1': 1, '2': 2, '4': 4, '6': 6, auto: 8 }
const core = [0x1f7, 0x1f9, 0x1fa, 0x1fd, 0x1fe]

export default class Device extends RAC {
    override isValuesResponse(values: TLV[]) {
        return core.every(id => values.some(v => v.t === id))
    }

    override processTLV(values: TLV[]) {
        const hadConfig = !!this.config
        const capabilitiesChanged = values.some(({t,v}) => t >= 0x2c0 && t <= 0x2ef && this.raw_clip_state[t] !== v)
        super.processTLV(values)
        // Real captures contain five state fields, not the RAC minimum of ten.
        // Basic discovery must also work when the RAC EEPROM capability tag is absent.
        if (!this.initialValuesReceived && this.isValuesResponse(values)) {
            clearInterval(this.query_caps_timeout)
            this.query_caps_timeout = undefined
            clearInterval(this.query_values_timeout)
            this.query_values_timeout = undefined
            this.valuesReceived()
        } else if (hadConfig && capabilitiesChanged) {
            this.initMakeSetConfig()
        }
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
        if (field.comp === 'energy_current') return
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
        // Standard RAC mode commands are experimental on CST until tested on hardware.
        climate.modes = ['off', 'cool', 'dry', 'fan_only', 'heat', 'auto']
        climate.temp_step = 1
        delete config.components.energy_current
        super.setConfig(config)
    }

    override setProperty(prop: string, value: string) {
        const field = this.fields_by_ha[prop]
        if (!field || field.writable === false) return
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
        super.setProperty(prop, value)
    }
}
