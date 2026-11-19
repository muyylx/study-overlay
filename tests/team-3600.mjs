import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solveTeam} from '../server/team.mjs';
const options=new Map([['A','Альфа'],['B','Бета']]);
const group=(votes,photo=false)=>{let i=0;return solveTeam({messages:[],options,keyOf:s=>options.has(s)?s:null,image:photo,
 run:async()=>{const v=votes[i++];if(v instanceof Error)throw v;return v?JSON.stringify({answer:v,reason:'Пример'}):'';}})};
test('counts independent ballots and keeps failures out of denominator',async()=>{const r=await group(['B','B','B','A',new Error('offline'),'Z']);assert.equal(r.answer,'B) Бета');assert.equal(r.team.valid,4);assert.equal(r.team.rows.length,6);});
test('split decision sends a second round and preserves initial votes',async()=>{const r=await group(['A','B','A','B','A','B','B']);assert.equal(r.answer,'B) Бета');assert.equal(r.team.agreed,3);assert.equal(r.team.reviewed,true);});
test('unresolved tie and all empty return actionable reasons',async()=>{await assert.rejects(group(['A','B','','','','','Z']),/поровну/);await assert.rejects(group([]),/пустой ответ/);});
test('photo reports text-only member separately',async()=>{const r=await group(['A','A','A','A','A'],true);assert.equal(r.team.valid,5);assert.equal(r.team.rows[5].status,'нужен распознанный текст');});
