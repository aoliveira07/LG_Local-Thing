import {test} from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
const root=resolve(process.env.RETHINK_BUILD_DIR || 'dist')
const load=p=>import(pathToFileURL(join(root,p)).href)
const {default:Device}=await load('cloud/devices/CST_570004_WW.js')
const {default:Bridge}=await load('cloud/ha_bridge.js')
const {parse}=await load('util/tlv.js')
const {default:crc}=await load('util/crc16.js')
const captured={
 '1':'000004000000a70204000c7dc17e407f90287e817f5028da58',
 '2':'000004000000a70204000c7dc17e407f90287e827f50284184',
 '4':'000004000000a70204000c7dc17e407f90287e847f5028661d',
 '6':'000004000000a70204000c7dc17e407f90287e867f50288b75',
 auto:'000004000000a70204000c7dc17e407f90287e887f5028292f',
}
function setup(){
 const ha=Object.assign(new EventEmitter(),{properties:{},publishProperty(id,key,val){this.properties[key]=val},publishConfig(id,c){this.config=c}})
 const thinq=Object.assign(new EventEmitter(),{id:'test-cst',platform:'thinq2',meta:{modelId:'CST_570004_WW',modelName:'AMNW24GTBA0'},outbox:[],send(){},send_packet(b){this.outbox.push(b)}})
 const bridge=new Bridge(ha);bridge.newDevice(thinq);const dev=bridge.haDevices.get(thinq.id);assert(dev instanceof Device)
 return {ha,thinq,dev}
}
function last(thinq){const b=thinq.outbox.at(-1);assert.equal(crc(b.subarray(2,-2)),b.readUInt16BE(b.length-2));return new Map(parse(b.subarray(11,-2)).map(x=>[x.t,x.v]))}
test('CST real corrected fan captures initialize discovery without RAC capability response',()=>{
 const {dev,ha,thinq}=setup();try{
 for(const [fan,h] of Object.entries(captured)){const b=Buffer.from(h,'hex');assert.equal(crc(b.subarray(2,-2)),b.readUInt16BE(b.length-2));thinq.emit('data',b);assert.equal(ha.properties['climate-fan_mode'],fan);assert.equal(ha.properties['climate-temperature'],20)}
 assert.deepEqual(ha.config.components.climate.fan_modes,['1','2','4','6','auto']);assert.equal(dev.query_caps_timeout,undefined)
 thinq.emit('data',Buffer.from('000004000000a70204000c7dc17e407f902c7e887f50282f8e','hex'));assert.equal(ha.properties['climate-temperature'],22)
 thinq.emit('data',Buffer.from('000004000000a70204000c7dc07e407f90287e887f5028f166','hex'));assert.equal(ha.properties['climate-mode'],'off')
 assert.equal(ha.config.components.climate.swing_modes,undefined);assert.equal(ha.config.components.energy_current,undefined)
 }finally{dev.drop()}
})
test('CST outgoing fan, temperature, power and standard mode packets have expected tags and CRC',()=>{
 const {dev,thinq}=setup();try{
 thinq.emit('data',Buffer.from(captured.auto,'hex'))
 for(const [fan,value] of Object.entries({'1':1,'2':2,'4':4,'6':6,auto:8})){dev.setProperty('climate-fan_mode',fan);assert.equal(last(thinq).get(0x1fa),value);assert.equal(last(thinq).get(0x1fe),40)}
 dev.setProperty('climate-temperature','22');assert.equal(last(thinq).get(0x1fe),44)
 for(const [mode,value] of Object.entries({cool:0,dry:1,fan_only:2,heat:4,auto:6})){dev.setProperty('climate-mode',mode);assert.equal(last(thinq).get(0x1f9),value)}
 dev.setProperty('climate-mode','off');assert.equal(last(thinq).get(0x1f7),0)
 dev.setProperty('climate-power','ON');assert.equal(last(thinq).get(0x1f7),1)
 const count=thinq.outbox.length;for(const x of ['3','5','7','bogus'])dev.setProperty('climate-fan_mode',x);for(const x of ['NaN','','Infinity','0','99','20.5'])dev.setProperty('climate-temperature',x);assert.equal(thinq.outbox.length,count)
 }finally{dev.drop()}
})
test('optional controls require advertised capabilities; late capabilities keep entity identity',()=>{
 const {dev,ha,thinq}=setup();try{
 thinq.emit('data',Buffer.from(captured.auto,'hex'));const id=ha.config.components.climate.unique_id
 // Synthetic capabilities exercise inherited protocol paths, not hardware validation.
 dev.processTLV([{t:0x2cd,v:15},{t:0x2cc,v:3},{t:0x2d3,v:5}])
 assert.equal(ha.config.components.climate.unique_id,id)
 assert(ha.config.components.climate.swing_modes.length);assert(ha.config.components.climate.swing_horizontal_modes.length)
 for(const mode of ha.config.components.climate.swing_modes){dev.setProperty('climate-swing_mode',mode);assert(last(thinq).has(0x321))}
 for(const mode of ha.config.components.climate.swing_horizontal_modes){dev.setProperty('climate-swing_horizontal_mode',mode);assert(last(thinq).has(0x322))}
 for(const [name,tag] of [['sleeptimer',0x21a],['starttimer',0x21c],['stoptimer',0x21b]]){assert(ha.config.components[name]);dev.setProperty(name+'-','1');assert.equal(last(thinq).get(tag),60)}
 assert(ha.config.components.airclean);assert(ha.config.components.jet);assert(ha.config.components.energysave)
 for(const [name,tag] of [['airclean',0x20f],['jet',0x323],['energysave',0x20d]]){for(const value of ['ON','OFF']){dev.setProperty(name+'-',value);assert.equal(last(thinq).get(tag),value==='ON'?1:0)}}
 const count=thinq.outbox.length;dev.setProperty('sleeptimer-','NaN');dev.setProperty('starttimer-','25');dev.setProperty('jet-','invalid');assert.equal(thinq.outbox.length,count)
 }finally{dev.drop()}
})
