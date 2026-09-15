import {test} from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
const root=resolve(process.env.RETHINK_BUILD_DIR||'dist')
const load=p=>import(pathToFileURL(join(root,p)).href)
const {commandSource,withCommandSource}=await load('util/command-source.js')
const {Bridge}=await load('bridge/index.js')
const {default:HABridge}=await load('cloud/ha_bridge.js')
const {DeviceManager}=await load('cloud/devmgr.js')
const {app}=await load('management/index.js')
const {Device:T2Device}=await load('cloud/thinq2/device.js')
const {once}=await import('node:events')
const {default:WebSocket}=await import(pathToFileURL(join(root,'../node_modules/ws/wrapper.mjs')).href)

test('HA dispatch has a distinct source and scoped origin never leaks between devices or exceptions',()=>{
 const ha=new EventEmitter(), bridge=new HABridge(ha), seen=[]
 bridge.haDevices.set('a',{setProperty(){seen.push(commandSource('a'))}})
 ha.emit('setProperty','a','mode','cool');assert.deepEqual(seen,['ha']);assert.equal(commandSource('a'),'local')
 assert.throws(()=>withCommandSource('a','lg',()=>{assert.equal(commandSource('a'),'lg');assert.equal(commandSource('b'),'local');withCommandSource('a','ha',()=>assert.equal(commandSource('a'),'ha'));assert.equal(commandSource('a'),'lg');throw Error('test')}))
 assert.equal(commandSource('a'),'local')
})

test('bridge rejects registration without explicit confirmation before any cloud request',async()=>{
 const manager=new DeviceManager(), state={getCredentials:()=>({refreshToken:'test-only',env:{countryCode:'BR'}}),getDeviceState:()=>undefined}
 const bridge=new Bridge(state,manager)
 manager.allDevices.a={id:'a',platform:'thinq2',meta:{}}
 assert.equal(bridge.registrationRequired('a'),true)
 await assert.rejects(bridge.enable('a','401'),/Confirme o recadastro/)
})

test('real monitor WebSocket reports LG, HA, local and manual separately',async()=>{
 const ha={HA:Object.assign(new EventEmitter(),{isConnected:true}),haDevices:new Map()},manager=new DeviceManager()
 const device=new T2Device({publish(){}},'test/topic','a',{modelId:'CST_570004_WW'})
 manager.allDevices.a=device
 const server=app(ha,manager,undefined);server.listen(0,'127.0.0.1');await once(server,'listening')
 const ws=new WebSocket(`ws://127.0.0.1:${server.address().port}/device?id=a`)
 try{
  const first=once(ws,'message');await once(ws,'open');await first
  for(const source of ['lg','ha','local']){const message=once(ws,'message');withCommandSource('a',source,()=>device.emit('sendData',Buffer.from('01010400000065020101027dc11557','hex')));const [data]=await message;assert.equal(JSON.parse(data.toString()).source,source)}
  const manual=once(ws,'message');ws.send(JSON.stringify({sendToDevice:'01010400000065020101027dc11557'}));const [data]=await manual;assert.equal(JSON.parse(data.toString()).source,'manual')
 }finally{ws.terminate();server.closeAllConnections();await new Promise(r=>server.close(r))}
})
