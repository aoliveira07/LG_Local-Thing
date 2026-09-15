import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync, readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { once, EventEmitter } from 'node:events'

const build = resolve(process.env.RETHINK_BUILD_DIR || 'dist')
const moduleAt = (name) => import(pathToFileURL(join(build, name)).href)
const { FriendlyNameStore, friendlyNames } = await moduleAt('util/friendly-names.js')
const { HomeAssistantAreas, isIngressAddress } = await moduleAt('util/ha-areas.js')
const { Connection } = await moduleAt('cloud/homeassistant.js')
const { app } = await moduleAt('management/index.js')
const { DeviceManager } = await moduleAt('cloud/devmgr.js')
const { WebSocketServer } = await import(pathToFileURL(join(build, '../node_modules/ws/wrapper.mjs')).href)

test('old 1.0.0 database survives room assignment, renaming and restart without changing entity IDs', () => {
    const dir=mkdtempSync(join(tmpdir(),'lg-room-')), file=join(dir,'names.json')
    try {
        writeFileSync(file, JSON.stringify({existing:{name:'Ar Casal',entityBase:'ar_casal'}}))
        const store=new FriendlyNameStore(file)
        assert.deepEqual(store.get('existing'),{name:'Ar Casal',entityBase:'ar_casal'})
        store.set('existing','Ar Suíte',{room:'Suíte',areaId:'suite'})
        assert.equal(store.get('existing').entityBase,'ar_casal')
        assert.equal(new FriendlyNameStore(file).get('existing').areaPending,true)
        store.markAreaSynced('existing','wrong'); assert.equal(store.pending().length,1)
        store.markAreaSynced('existing','suite'); assert.equal(store.pending().length,0)
        store.set('existing','Novo nome'); assert.equal(store.get('existing').room,'Suíte')
        store.set('existing','Novo nome',{room:'',areaId:null})
        assert.equal(new FriendlyNameStore(file).get('existing').areaId,null)
        assert.throws(()=>store.set('new','Ar Casal'),/already assigned/)
        assert.throws(()=>store.set('new',' '),/empty/)
        assert.throws(()=>store.set('new','a'.repeat(81)),/80/)
    } finally {rmSync(dir,{recursive:true,force:true})}
})

test('a failed atomic write does not mutate the in-memory identity',()=>{
    const dir=mkdtempSync(join(tmpdir(),'lg-atomic-')),file=join(dir,'names.json')
    try {
        const store=new FriendlyNameStore(file);store.set('id','Original')
        mkdirSync(file+'.tmp')
        assert.throws(()=>store.set('id','Changed'))
        assert.equal(store.get('id').name,'Original')
        assert.equal(JSON.parse(readFileSync(file)).id.name,'Original')
    } finally {rmSync(dir,{recursive:true,force:true})}
})

test('discovery gates unnamed devices and preserves unique IDs and topic on rename',()=>{
    const sent=[]
    const connection={config:{discovery_prefix:'homeassistant',rethink_prefix:'rethink'},client:{publish:(...args)=>sent.push(args)}}
    const config={device:{identifiers:'$deviceid'},origin:{name:'rethink'},components:{climate:{name:null,platform:'climate',unique_id:'physical-id'},temperature:{platform:'sensor',unique_id:'physical-temp'}}}
    Connection.prototype.publishConfig.call(connection,'unit-1',config);assert.equal(sent.length,0)
    friendlyNames.set('unit-1','Ar Sala',{room:'Sala',areaId:'sala'})
    Connection.prototype.publishConfig.call(connection,'unit-1',config)
    const first=JSON.parse(sent[0][1]);assert.equal(first.device.suggested_area,'Sala');assert.equal(first.device.identifiers,'unit-1')
    assert.equal(first.components.climate.default_entity_id,'climate.ar_sala')
    friendlyNames.set('unit-1','Ar Escritório',{room:'Escritório',areaId:'escritorio'})
    Connection.prototype.publishConfig.call(connection,'unit-1',config)
    const next=JSON.parse(sent[1][1]);assert.equal(next.device.name,'Ar Escritório');assert.deepEqual(next.components,first.components);assert.equal(sent[0][0],sent[1][0])
})

test('HA WebSocket authentication, existing/new rooms, exact identifier and removal',async()=>{
    const server=new WebSocketServer({port:0,host:'127.0.0.1'})
    await once(server,'listening')
    const commands=[],areas=[{area_id:'sala',name:'Sala'}]
    let registry=[{id:'unrelated',identifiers:[['mqtt','other-id']],area_id:null},{id:'ha-device',identifiers:[['mqtt','unit-1']],area_id:null}]
    server.on('connection',ws=>{
        ws.send(JSON.stringify({type:'auth_required'}))
        ws.on('message',raw=>{
            const msg=JSON.parse(raw)
            if(msg.type==='auth'){assert.equal(msg.access_token,'test-token');ws.send(JSON.stringify({type:'auth_ok'}));return}
            commands.push(msg)
            let result
            if(msg.type==='config/area_registry/list')result=areas
            if(msg.type==='config/area_registry/create'){result={area_id:'new-area',name:msg.name};areas.push(result)}
            if(msg.type==='config/device_registry/list')result=registry
            if(msg.type==='config/device_registry/update'){assert.equal(msg.device_id,'ha-device');result={id:msg.device_id,area_id:msg.area_id}}
            ws.send(JSON.stringify({id:msg.id,type:'result',success:true,result}))
        })
    })
    try {
        const client=new HomeAssistantAreas(`ws://127.0.0.1:${server.address().port}`,'test-token')
        assert.deepEqual(await client.list(),areas)
        assert.deepEqual(await client.resolve('sala'),{areaId:'sala',room:'Sala'})
        assert.deepEqual(await client.resolve(null,' SALA '),{areaId:'sala',room:'Sala'})
        assert.deepEqual(await client.resolve(null,'Quarto'),{areaId:'new-area',room:'Quarto'})
        await assert.rejects(client.resolve('deleted'),/não existe/)
        assert.equal(await client.assign('unit-1','sala'),true)
        registry[1].area_id='sala';assert.equal(await client.assign('unit-1',null),true)
        assert.equal(await client.assign('missing','sala'),false)
        registry.push({id:'duplicate',identifiers:[['mqtt','unit-1']],area_id:null})
        assert.equal(await client.assign('unit-1','sala'),false)
        assert.equal(commands.filter(c=>c.type==='config/area_registry/create').length,1)
        assert.equal(commands.filter(c=>c.type==='config/device_registry/update').length,2)
    } finally {for(const ws of server.clients)ws.terminate();await new Promise(r=>server.close(r))}
})

test('authentication errors propagate without exposing tokens',async()=>{
    const server=new WebSocketServer({port:0,host:'127.0.0.1'});await once(server,'listening')
    server.on('connection',ws=>{ws.send(JSON.stringify({type:'auth_required'}));ws.on('message',()=>ws.send(JSON.stringify({type:'auth_invalid'})))})
    try {await assert.rejects(new HomeAssistantAreas(`ws://127.0.0.1:${server.address().port}`,'never-show-token').list(),/recusou a autorização/)}
    finally {for(const ws of server.clients)ws.terminate();await new Promise(r=>server.close(r))}
})

test('room APIs reject direct LAN requests even with spoofed ingress headers',async()=>{
    assert.equal(isIngressAddress('172.30.32.2'),true)
    assert.equal(isIngressAddress('::ffff:172.30.32.2'),true)
    assert.equal(isIngressAddress('127.0.0.1'),false)
    const ha={HA:Object.assign(new EventEmitter(),{isConnected:true}),haDevices:new Map()}
    const manager=new DeviceManager()
    manager.allDevices['unit-1']={id:'unit-1',meta:{},platform:'thinq2'}
    const server=app(ha,manager,undefined);server.listen(0,'127.0.0.1');await once(server,'listening')
    try {
        const url=`http://127.0.0.1:${server.address().port}`
        const headers={'X-Forwarded-For':'172.30.32.2','X-Ingress-Path':'/api/hassio_ingress/fake','Content-Type':'application/json'}
        assert.equal((await fetch(url+'/areas',{headers})).status,403)
        assert.equal((await fetch(url+'/device/unit-1/name',{method:'POST',headers,body:JSON.stringify({name:'Name',areaId:'sala'})})).status,403)
    } finally {server.closeAllConnections();await new Promise(r=>server.close(r))}
})
