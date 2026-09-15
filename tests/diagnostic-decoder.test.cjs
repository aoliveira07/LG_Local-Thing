const {test}=require('node:test'),assert=require('node:assert/strict');
const {describePacket}=require('../lg_local_thing/overrides/html/diagnostics.js');
test('real validated CST frames decode known fields; malformed and bad CRC frames are not interpreted',()=>{
 assert.equal(describePacket('01010400000065020101027dc11557'),'Estado: ligado');
 const state=describePacket('000004000000a70204000c7dc17e407f902c7e887f502c6f0a');
 assert.match(state,/Estado: ligado/);assert.match(state,/Ajuste: 22 °C/);assert.match(state,/Ventilação: auto/);
 for(const bad of ['','zz','01010400000065020101027dc11558','0201040000008701100000ec3c'])assert.equal(describePacket(bad),'');
});
