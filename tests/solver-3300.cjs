const test=require('node:test');
const assert=require('node:assert/strict');
global.window={};
require('../units.js');
require('../arithmetic.js');
const dimensions=[['км','м',1000],['кг','г',1000],['мин','с',60],['га','м²',10000],['л','мл',1000],['кПа','Па',1000],['кДж','Дж',1000],['кВт','Вт',1000],['кГц','Гц',1000],['м/с','км/ч',3.6]];
for(const [from,to,factor] of dimensions){
 for(let i=1;i<=5;i++){
   const qty=5*i;
   test(qty+' '+from+' в '+to,()=>assert.equal(window.scannerUnits(qty+' '+from+' в '+to),Math.round(qty*factor)+' '+to));
 }
}
for(let k=1;k<=10;k++)for(const x of [-3,-1,0,2,7]){
 const q=(k+3)+'x+'+(k+2)+'='+k+'x'+(3*x+k+2<0?'':'+')+(3*x+k+2);
 test(q,()=>assert.equal(window.scannerArithmetic(q),String(x)));
}
for(const [q,expected] of [['1 км в кг',null],['1 мин в с?','60 с'],['1 км/ч в м/с','5/18 м/с'],['Переведіть 2,4 кг у г','2400 г'],['0,1 л у ml\nВарианты:\nA) 10 ml\nB) 100 мл','B) 100 мл'],['5 м в см\nВарианты:\nA) 500\nB) 500 см',null],['Сколько времени займет 5 км в м?',null]]){
 test(q,()=>assert.equal(window.scannerUnits(q),expected));
}
