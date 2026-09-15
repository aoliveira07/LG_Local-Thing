// LG Local Thing / Smart House. Diagnostic UI derived from ReThink, GPL v2.
'use strict'
const get = id => document.getElementById(id)
const base = new URL('./', window.location.href)
const deviceId = new URLSearchParams(window.location.search).get('id')
let ws, reconnectTimer, retryDelay = 250, online = false
get('device_id').textContent = deviceId || 'Não informado'
get('back-link').href = base.href
function status(text, active = false) {
    online = active
    get('device_status').textContent = text
    get('device_status').className = `badge ${active ? 'good' : 'pending'}`
    get('btn_send1').disabled = get('btn_send2').disabled = !active
}
function connect() {
    clearTimeout(reconnectTimer)
    if (ws) { ws.onclose = ws.onopen = ws.onmessage = null; ws.close() }
    const url = new URL('device', base)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.searchParams.set('id', deviceId)
    ws = new WebSocket(url)
    ws.onopen = () => { retryDelay = 250; status('Aguardando aparelho') }
    ws.onclose = () => { status('Reconectando…'); reconnectTimer = setTimeout(connect, retryDelay); retryDelay = 5000 }
    ws.onmessage = event => {
        let data; try { data = JSON.parse(event.data) } catch { return }
        if (data.rx) pushMessage('rx', String(data.rx), data.injected)
        if (data.tx) pushMessage('tx', String(data.tx), data.injected)
        if (data.status) status(data.status === 'online' ? 'Conectado' : 'Desconectado', data.status === 'online')
        if (data.meta) get('device_model').textContent = data.meta.modelId || 'Não informado'
    }
}
function pushMessage(direction, payload, injected) {
    get('message-empty')?.remove()
    const messages = get('messages'), div = document.createElement('div'), time = document.createElement('span')
    div.className = `message ${direction}${injected ? ' injected' : ''}`
    div.tabIndex = 0; div.setAttribute('role', 'button')
    div.setAttribute('aria-label', `${direction === 'rx' ? 'Recebida' : 'Enviada'}: copiar para diagnóstico`)
    time.className = 'timestamp'; time.textContent = `${new Date().toLocaleTimeString('pt-BR')} · ${direction === 'rx' ? 'Recebida' : 'Enviada'}${injected ? ' · Simulada' : ''}`
    div.append(time, document.createTextNode(payload))
    const copy = () => { get(direction === 'rx' ? 'send2' : 'send1').value = payload; document.querySelector('.monitor-advanced').open = true }
    div.onclick = copy; div.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy() } }
    messages.append(div)
    while (messages.children.length > 500) { const first = messages.firstElementChild; const height = first.getBoundingClientRect().height + 8; first.remove(); if (!get('autoscroll').checked) messages.scrollTop = Math.max(0, messages.scrollTop - height) }
    if (get('autoscroll').checked) messages.scrollTop = messages.scrollHeight
}
function send(fromDevice) {
    get('command-error').hidden = true
    if (!online || ws?.readyState !== WebSocket.OPEN) return
    const text = get(fromDevice ? 'send2' : 'send1').value.trim()
    if (!text) return
    try {
        const command = !fromDevice && text.startsWith('{') ? JSON.parse(text) : text
        ws.send(JSON.stringify(fromDevice ? {sendFromDevice: command} : {sendToDevice: command}))
    } catch { get('command-error').textContent = 'Não foi possível enviar. Confira o JSON e a conexão.'; get('command-error').hidden = false }
}
get('btn_send1').onclick = () => send(false)
get('btn_send2').onclick = () => send(true)
get('clear-messages').onclick = () => get('messages').replaceChildren()
get('autoscroll').onchange = () => { if (get('autoscroll').checked) get('messages').scrollTop = get('messages').scrollHeight }
window.addEventListener('pageshow', event => { if (event.persisted && deviceId) connect() })
window.addEventListener('pagehide', () => { clearTimeout(reconnectTimer); if (ws) { ws.onclose = null; ws.close() } })
if (deviceId) connect(); else status('Aparelho não informado')
