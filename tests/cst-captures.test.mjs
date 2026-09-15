import {test} from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {readFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
const root=resolve(process.env.RETHINK_BUILD_DIR || 'dist')
const load=p=>import(pathToFileURL(join(root,p)).href)
const {default:Device}=await load('cloud/devices/CST_570004_WW.js')
const {parse}=await load('util/tlv.js')
const {default:crc}=await load('util/crc16.js')
const captures=JSON.parse(readFileSync(new URL('./fixtures/cst-lg.json',import.meta.url),'utf8').replace(/^\uFEFF/,''))
const flags=[0x205,0x28e,0x28f,0x290,0x291,0x325]
function setup(){
 const ha={properties:{},publishProperty(id,key,val){this.properties[key]=val},publishConfig(id,c){this.config=c}}
 const thinq=Object.assign(new EventEmitter(),{id:'fixture-device',outbox:[],send(){},send_packet(b){this.outbox.push(b)}})
 const dev=new Device(ha,thinq,{modelId:'CST_570004_WW',modelName:'AMNW24GTBA0'})
 dev.processTLV([{t:0x1f7,v:1},{t:0x1f9,v:0},{t:0x1fa,v:8},{t:0x1fd,v:42},{t:0x1fe,v:40}])
 return {dev,ha,thinq}
}
const commands={1:['climate-temperature','22'],2:['climate-temperature','23'],3:['climate-fan_mode','1'],4:['climate-fan_mode','2'],5:['climate-fan_mode','4'],6:['climate-fan_mode','6'],7:['climate-fan_mode','auto'],8:['climate-fan_mode','Força'],9:['climate-fan_mode','auto'],10:['climate-mode','dry'],11:['climate-mode','fan_only'],12:['climate-mode','heat'],13:['climate-mode','auto'],'14a':['climate-mode','cool'],'14b':['climate-temperature','19'],'14c':['climate-temperature','20'],15:['climate-swing_mode','on'],16:['climate-swing_mode','off'],17:['airflow-','Fluxo de ar indireto'],18:['airflow-','Fluxo de ar direto'],19:['airflow-','Modo Smart'],20:['airflow-','Modo de atualização'],21:['airflow-','Agitar'],22:['airflow-','Desligado'],23:['climate-swing_mode','Padr.'],24:['climate-swing_mode','4'],25:['climate-swing_mode','5'],26:['climate-swing_mode','6'],27:['climate-swing_mode','1'],28:['climate-swing_mode','2'],29:['climate-swing_mode','3']}

test('every captured LG command is reproduced byte for byte, including CRC',()=>{
 for(const capture of captures){
  const {dev,ha,thinq}=setup()
  try{
   const expected=Buffer.from(capture.tx,'hex')
   assert.equal(crc(expected.subarray(2,-2)),expected.readUInt16BE(expected.length-2))
   // HA supplies the desired climate settings; LG may recall a per-mode temperature.
   dev.processTLV(parse(expected.subarray(11,-2)))
   dev.processTLV([{t:0x321,v:0},...flags.map(t=>({t,v:0}))])
   if(capture.step===16)dev.processTLV([{t:0x205,v:1}])
   if(capture.step===22)dev.processTLV([{t:0x325,v:1}])
   if(capture.step===8)dev.processTLV([{t:0x1fa,v:8},{t:0x1fe,v:46}])
   const before=JSON.stringify(ha.properties)
   thinq.outbox=[]
   dev.setProperty(...commands[capture.step])
   assert.deepEqual(thinq.outbox.map(b=>b.toString('hex')),[capture.tx],`step ${capture.step}`)
   assert.equal(JSON.stringify(ha.properties),before,'do not publish optimistic state')
   for(const rx of [capture.rx].flat()){
    const packet=Buffer.from(rx,'hex')
    assert.equal(crc(packet.subarray(2,-2)),packet.readUInt16BE(packet.length-2))
    thinq.emit('data',packet)
   }
  }finally{dev.drop()}
 }
})

test('late discovery adds collective positions and airflow, without horizontal or individual controls',()=>{
 const {dev,ha,thinq}=setup()
 try{
  const identity=ha.config.components.climate.unique_id
  assert.equal(ha.config.components.airflow,undefined)
  const circular=captures.find(c=>c.step===15)
  thinq.emit('data',Buffer.from(circular.rx,'hex'))
  assert.equal(ha.config.components.climate.unique_id,identity)
  assert.equal(ha.properties['airflow-'],'Circular')
  assert.equal(ha.properties['climate-swing_mode'],'on')
  assert.equal(ha.config.components.climate.swing_horizontal_modes,undefined)
  assert.deepEqual(ha.config.components.climate.swing_modes,['off','on','Padr.','1','2','3','4','5','6'])
  for(const c of captures.filter(c=>Number(c.step)>=17))for(const rx of [c.rx].flat())thinq.emit('data',Buffer.from(rx,'hex'))
  assert.equal(ha.properties['climate-swing_mode'],'3')
  assert.equal(ha.properties['airflow-'],'Desligado')
  thinq.outbox=[]
  for(const value of ['7','NaN','Individual',''])dev.setProperty('climate-swing_mode',value)
  dev.setProperty('airflow-','invalid');dev.setProperty('climate-swing_horizontal_mode','on')
  assert.equal(thinq.outbox.length,0)
 }finally{dev.drop()}
})

test('Força is cooling-only; its device response sets 18 C and leaving it retains 18 C',()=>{
 const {dev,ha,thinq}=setup()
 try{
  dev.processTLV([{t:0x1f9,v:4}]);thinq.outbox=[]
  dev.setProperty('climate-fan_mode','Força');assert.equal(thinq.outbox.length,0)
  dev.processTLV([{t:0x1f9,v:0},{t:0x1fe,v:46}])
  dev.setProperty('climate-fan_mode','Força')
  assert.equal(ha.properties['climate-temperature'],23)
  thinq.emit('data',Buffer.from(captures.find(c=>c.step===8).rx,'hex'))
  assert.equal(ha.properties['climate-temperature'],18)
  assert.equal(ha.properties['climate-fan_mode'],'Força')
  dev.setProperty('climate-fan_mode','auto')
  assert.equal(thinq.outbox.at(-1).toString('hex'),captures.find(c=>c.step===9).tx)
 }finally{dev.drop()}
})
