// Smart House / ReThink GPL v2. Packet observations, not execution acknowledgements.
function describePacket(hex, modelId) {
    if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) return ''
    const b = hex.match(/../g).map(x => parseInt(x, 16))
    if (b.length < 13 || b[2] !== 4 || b[3] || b[4] || b[5] || ![0x65,0x87,0xa7].includes(b[6]) || b[7] !== 2 || ![1,4].includes(b[8]) || b[10] !== b.length-13) return ''
    let crc = 0
    for (const value of b.slice(2,-2)) { crc ^= value<<8; for(let bit=0;bit<8;bit++) crc = ((crc<<1)^((crc&0x8000)?0x1021:0))&0xffff }
    if (crc !== (b.at(-2)<<8 | b.at(-1))) return ''
    const fields=[]
    for(let i=11;i<b.length-2;) {
        const t=(b[i]<<2)|(b[i+1]>>6), length=(b[i+1]>>4)&3
        if(i+2+length>b.length-2)return ''
        let value=b[i+1]&15
        if(length){value=0;for(let j=0;j<length;j++)value=value*256+b[i+2+j]}
        const modes={0:'Refrigerar',1:'Desumidificar',2:'Ventilar',4:'Aquecer',6:'Automático'}
        if(t===0x1f7)fields.push(`Estado: ${value===0?'desligado':value===1?'ligado':value}`)
        if(t===0x1f9)fields.push(`Modo: ${modes[value]??value}`)
        if(t===0x1fe)fields.push(`Ajuste: ${value/2} °C`)
        if(t===0x1fa)fields.push(`Ventilação: ${value===8?'auto':modelId==='CST_570004_WW'&&value===7?'Força':value} (protocolo)`)
        if(t===0x1fd)fields.push(`Temperatura informada: ${value/2} °C`)
        if(modelId==='CST_570004_WW') {
            if(t===0x321) {
                const position=[0,1,2,3,4,5,6].find(n=>value===n*0x1111)
                fields.push(`Aletas: ${position===0?'Padr.':position!==undefined?'todas na posição '+position:'posição combinada '+value.toString(16)}`)
            }
            const airflow={0x205:'Circular',0x28e:'Fluxo indireto',0x28f:'Fluxo direto',0x290:'Modo Smart',0x291:'Modo de atualização',0x325:'Agitar'}
            if(airflow[t])fields.push(`${airflow[t]}: ${value===1?'ligado':value===0?'desligado':value}`)
        } else {
            if(t===0x321)fields.push(`Swing vertical: ${value} (protocolo)`)
            if(t===0x322)fields.push(`Swing horizontal: ${value} (protocolo)`)
        }
        i+=2+length
    }
    return fields.join(' · ')
}
if (typeof module !== 'undefined') module.exports = { describePacket }
