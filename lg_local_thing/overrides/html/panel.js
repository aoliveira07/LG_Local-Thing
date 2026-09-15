// LG Local Thing / Smart House, 2026-09-14. UI derived from ReThink, GPL v2.
'use strict'
const $ = (id) => document.getElementById(id)
const base = new URL('./', window.location.href)
let devices = {}, bridge, socket, retryTimer, retryDelay = 250, connected = false
let editingId = null, saving = false, areaRequest = 0, areasLoaded = false
let toastTimer
function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 6500) }
async function api(path, body, method = 'POST') {
    const response = await fetch(new URL(path, base), { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    if (!response.ok) throw new Error((await response.text()) || `Falha HTTP ${response.status}`)
    return response
}
function badge(id, text, state = '') { $(id).textContent = text; $(id).className = `badge ${state}` }
function el(tag, cls, text) { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node }
function deviceType(type) { return ({'101':'Geladeira','201':'Lavadora','202':'Secadora','204':'Lava-louças','223':'WashTower','301':'Fogão','302':'Micro-ondas','401':'Ar-condicionado'})[String(type)] || 'Aparelho LG' }
function symbol(type) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('viewBox','0 0 40 40'); svg.classList.add('device-symbol'); svg.setAttribute('aria-hidden','true')
    const shapes = String(type) === '401' ? '<rect x="3" y="8" width="34" height="19" rx="3"/><path d="M7 21h26M11 30v5m9-5v5m9-5v5"/>' : String(type) === '101' ? '<rect x="10" y="2" width="20" height="36" rx="3"/><path d="M10 17h20m-15-9v5m0 9v8"/>' : '<rect x="6" y="3" width="28" height="34" rx="4"/><circle cx="20" cy="23" r="9"/><path d="M11 9h9m5 0h4"/>'
    svg.innerHTML = shapes // constant SVG only; user/device data is inserted via textContent
    return svg
}
function render() {
    const container = $('devices'); container.replaceChildren()
    const entries = Object.entries(devices)
    const missing = entries.filter(([, d]) => !d.name).length
    $('device-count').textContent = `${entries.length} conectado${entries.length === 1 ? '' : 's'}`
    $('empty-state').hidden = entries.length !== 0 || !connected
    $('setup-notice').hidden = !missing
    $('setup-notice').textContent = `${missing} aparelho(s) aguardando configuração. Defina nome e cômodo antes de adicioná-los ao Home Assistant.`
    for (const [id, d] of entries) {
        const card = el('article', `device-card${d.name ? '' : ' needs-setup'}`)
        const row = el('div','device-row'), identity = el('div','device-identity'), naming = el('div')
        naming.append(el('h3','device-name',d.name || 'Novo aparelho LG'))
        naming.append(el('div','device-meta',d.name ? d.entityBase : `${deviceType(d.deviceType)} · Nome ainda não definido`))
        const state = el('span',`badge ${d.name ? (d.mapped ? 'good' : 'pending') : 'pending'}`,!d.name ? 'Configuração pendente' : d.mapped ? 'Conectado' : 'Modelo não mapeado')
        state.style.marginTop = '8px'; naming.append(state); identity.append(symbol(d.deviceType), naming); row.append(identity)
        const room = el('div'); room.append(el('div','field-label','Cômodo'),el('strong','',d.room || 'Sem cômodo'))
        if (d.areaPending) room.append(el('div','device-meta','Aguardando associação no HA'))
        const model = el('div'); model.append(el('div','field-label','Modelo / Protocolo'),el('strong','',d.model || 'Não informado'),el('div','device-meta',d.platform || '—'))
        row.append(room,model)
        const actions = el('div','device-actions'), monitor = el('a','button secondary','Monitorar')
        monitor.href = new URL(`monitor?id=${encodeURIComponent(id)}`,base).href
        const edit = el('button',d.name ? 'secondary' : '',d.name ? 'Renomear / cômodo' : 'Configurar aparelho')
        edit.disabled = !connected; edit.addEventListener('click',() => openIdentity(id)); actions.append(monitor,edit); row.append(actions); card.append(row)
        const advanced = el('details','device-advanced'); advanced.append(el('summary','', 'Informações e opções avançadas'),el('p','device-meta',`ID: ${id}`))
        const tools = el('div','actions'), toggle = el('button','secondary',d.bridged ? 'Desativar bridge' : 'Ativar bridge')
        toggle.disabled = !bridge?.loggedIn || !connected
        toggle.addEventListener('click',async () => {
            let type = d.deviceType
            if (!d.bridged && !type) { type = prompt('Tipo do aparelho (ex.: 401 para ar-condicionado):'); if (!type || !/^\d{3}$/.test(type)) return }
            toggle.disabled = true
            try { await api(`bridge/${encodeURIComponent(id)}/${d.bridged ? 'disable' : 'enable'}`, d.bridged ? {} : {deviceType:String(type)}) }
            catch (error) { toast(error.message) }
            finally { toggle.disabled = !bridge?.loggedIn }
        })
        const download = el('button','secondary','Baixar modelo JSON'); download.disabled = !(bridge?.loggedIn && d.bridged && connected)
        download.addEventListener('click',async () => {
            download.disabled = true
            try { const response = await api(`bridge/${encodeURIComponent(id)}/modeljson`,undefined,'GET'); const url = URL.createObjectURL(await response.blob()); const a = el('a'); a.href=url; a.download=`modelo-${id.replace(/[^a-z0-9-]/gi,'_')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000) }
            catch(error) { toast(error.message) } finally { download.disabled = !(bridge?.loggedIn && d.bridged) }
        })
        tools.append(toggle,download); advanced.append(tools); card.append(advanced); container.append(card)
    }
}
function closeIdentity() { if (saving) return; areaRequest++; editingId=null; $('identity-dialog').close() }
async function loadAreas(id) {
    const request = ++areaRequest; areasLoaded = false
    $('device-area').disabled = true; $('device-area').replaceChildren(new Option('Carregando cômodos…','keep'))
    $('reload-areas').hidden=true
    try {
        const response = await api('areas',undefined,'GET'), areas = await response.json()
        if (request !== areaRequest || editingId !== id) return
        const d = devices[id] || {}
        $('device-area').replaceChildren(new Option(d.areaId === undefined ? 'Sem cômodo' : 'Manter cômodo atual','keep'),new Option('Sem cômodo — remover associação','none'))
        for (const area of areas.sort((a,b) => a.name.localeCompare(b.name,'pt-BR'))) $('device-area').add(new Option(area.name,area.area_id))
        $('device-area').add(new Option('+ Criar novo cômodo…','new'))
        // Default to no mutation: only an explicit selection moves a registered HA device.
        $('device-area').value='keep'; $('device-area').disabled=false; areasLoaded=true
        $('area-help').textContent = d.room ? `Cômodo salvo: ${d.room}. Selecione outro para mover o aparelho no HA.` : 'Escolha um cômodo ou crie um novo; ele será associado ao aparelho no Home Assistant.'
    } catch(error) {
        if (request !== areaRequest || editingId !== id) return
        $('device-area').replaceChildren(new Option('Manter cômodo / configurar depois','keep'))
        $('area-help').textContent = `${error.message} Você ainda pode salvar o nome.`
        $('reload-areas').hidden=false
    }
}
function openIdentity(id) {
    const d = devices[id]; if (!d) return
    editingId=id; $('identity-form').reset(); $('identity-error').hidden=true; $('new-area-field').hidden=true
    $('identity-title').textContent = d.name ? 'Editar nome e cômodo' : 'Configurar novo aparelho'
    $('identity-description').textContent = d.name ? 'O nome pode mudar. Os IDs das entidades e suas automações serão preservados.' : 'Dê um nome ao aparelho e escolha onde ele fica. Ao salvar, os modelos compatíveis serão adicionados ao Home Assistant.'
    $('device-name').value=d.name || ''; $('device-name').placeholder=d.cloudName || 'Ex.: Ar-condicionado Sala'
    $('identity-save').textContent=d.name ? 'Salvar alterações' : 'Salvar e adicionar ao HA'
    $('identity-dialog').showModal(); $('device-name').focus(); void loadAreas(id)
}
$('device-area').addEventListener('change',() => { const create = $('device-area').value==='new'; $('new-area-field').hidden=!create; $('new-area-name').required=create })
$('identity-close').onclick=$('identity-cancel').onclick=closeIdentity
$('identity-dialog').addEventListener('cancel',(event) => {event.preventDefault();closeIdentity()})
$('reload-areas').onclick=() => { if(editingId) void loadAreas(editingId) }
$('identity-form').addEventListener('submit',async (event) => {
    event.preventDefault(); if (saving || !editingId) return
    const id=editingId, name=$('device-name').value.trim(), selected=$('device-area').value
    if (!name) { $('device-name').setCustomValidity('Informe o nome do aparelho.'); $('device-name').reportValidity(); return }
    if (!connected || !devices[id]) { $('identity-error').textContent='O aparelho não está mais conectado. Aguarde e tente novamente.'; $('identity-error').hidden=false; return }
    const body={name}
    if(areasLoaded && selected!=='keep') { body.areaId=selected==='none'||selected==='new' ? null : selected; if(selected==='new') body.newArea=$('new-area-name').value.trim() }
    saving=true; $('identity-error').hidden=true
    for(const control of $('identity-form').elements) control.disabled=true
    try {
        const response=await api(`device/${encodeURIComponent(id)}/name`,body), identity=await response.json()
        if(devices[id]) Object.assign(devices[id],identity)
        render(); toast(identity.areaPending ? 'Nome salvo. Associando o cômodo no Home Assistant…' : 'Nome salvo.'); saving=false;closeIdentity()
    } catch(error) { $('identity-error').textContent=error.message; $('identity-error').hidden=false }
    finally { saving=false; for(const control of $('identity-form').elements) control.disabled=false; $('device-area').disabled=!areasLoaded }
})
$('device-name').addEventListener('input',()=>$('device-name').setCustomValidity(''))
function connect() {
    clearTimeout(retryTimer)
    if(socket) { socket.onclose=socket.onopen=socket.onmessage=null; socket.close() }
    const url=new URL('ws',base); url.protocol=url.protocol==='https:'?'wss:':'ws:'; socket=new WebSocket(url)
    socket.onopen=()=>{ connected=true;retryDelay=250;badge('server-status','Online','good');$('connection-notice').hidden=true;render() }
    socket.onclose=()=>{ connected=false;badge('server-status','Reconectando','bad');badge('mqtt-status','Desconhecido');$('connection-notice').hidden=false;$('connection-notice').textContent='Conexão interrompida. Os dados podem estar desatualizados; tentando reconectar…';render();retryTimer=setTimeout(connect,retryDelay);retryDelay=5000 }
    socket.onmessage=(event)=>{
        let data;try{data=JSON.parse(event.data)}catch{return}
        if(typeof data.ha==='boolean') badge('mqtt-status',data.ha?'Conectado':'Desconectado',data.ha?'good':'bad')
        if(Object.prototype.hasOwnProperty.call(data,'bridge')) bridge=data.bridge
        if(data.devices && typeof data.devices==='object') devices=data.devices
        badge('bridge-status',bridge?.loggedIn?'Conectado':bridge?'Não configurado':'Desativado',bridge?.loggedIn?'good':'')
        $('bridge-login').hidden=!bridge || !!bridge.loggedIn; $('bridge-logout').hidden=!bridge?.loggedIn
        if(data.status) toast(String(data.status));render()
    }
}
$('bridge-login').onclick=()=>$('login-dialog').showModal()
$('login-cancel').onclick=()=>$('login-dialog').close()
$('open-lg-login').onclick=()=>{ if(!$('country-code').reportValidity())return; window.open(new URL(`thinq_login?countryCode=${encodeURIComponent($('country-code').value.toUpperCase())}`,base),'_blank','noopener,noreferrer') }
$('login-form').onsubmit=async(event)=>{event.preventDefault();try{await api('thinq_login_accept',{url:$('login-url').value,countryCode:$('country-code').value.toUpperCase()});$('login-url').value='';$('login-dialog').close()}catch(error){$('login-error').hidden=false;$('login-error').textContent=error.message}}
$('bridge-logout').onclick=async()=>{if(!confirm('Sair da conta LG e desativar o bridge de todos os aparelhos?'))return;try{await api('thinq_logout',{});toast('Conta LG desconectada.')}catch(error){toast(error.message)}}
window.addEventListener('pageshow',(event)=>{if(event.persisted)connect()})
connect()
