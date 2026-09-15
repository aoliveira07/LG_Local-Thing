const {test}=require('node:test'),assert=require('node:assert/strict');
const {describePacket}=require('../lg_local_thing/overrides/html/diagnostics.js');
test('real validated CST frames decode known fields; malformed and bad CRC frames are not interpreted',()=>{
 assert.equal(describePacket('01010400000065020101027dc11557'),'Estado: ligado');
 const state=describePacket('000004000000a70204000c7dc17e407f902c7e887f502c6f0a');
 assert.match(state,/Estado: ligado/);assert.match(state,/Ajuste: 22 °C/);assert.match(state,/Ventilação: auto/);
 for(const bad of ['','zz','01010400000065020101027dc11558','0201040000008701100000ec3c'])assert.equal(describePacket(bad),'');
});

test('CST collective vanes and airflow use model-specific decoding',()=>{
 const fixtures=require('./fixtures/cst-lg.json');
 const describe=step=>describePacket(fixtures.find(c=>c.step===step).tx,'CST_570004_WW');
 assert.match(describe(8),/Ventilação: Força/);
 assert.match(describe(15),/Circular: ligado/);
 assert.match(describe(16),/Circular: desligado/);
 assert.match(describe(23),/Aletas: Padr\./);
 assert.match(describe(26),/Aletas: todas na posição 6/);
 assert.match(describe(20),/Modo de atualização: ligado/);
 assert.match(describePacket(fixtures.find(c=>c.step===26).tx,'RAC_056905_WW'),/Swing vertical:/);
 assert.doesNotMatch(describe(26),/Swing horizontal|Swing vertical/);
});
