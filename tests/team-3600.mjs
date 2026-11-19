import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solveTeam} from '../server/team.mjs';
const options=new Map([['A','Альфа'],['B','Бета']]);
const group=(votes,photo=false)=>{let i=0;return solveTeam({messages:[],options,keyOf:s=>options.has(s)?s:null,image:photo,
 run:async()=>{const v=votes[i++];if(v instanceof Error)throw v;return v?JSON.stringify({answer:v,reason:'Пример'}):'';}})};
test('counts independent ballots and keeps failures out of denominator',async()=>{const r=await group(['B',new Error('offline'),'B','Z']);assert.equal(r.answer,'B) Бета');assert.equal(r.team.valid,2);assert.equal(r.team.rows.length,4);});
test('split decision sends a second round and preserves initial votes',async()=>{const r=await group(['A','B','A','B','B']);assert.equal(r.answer,'B) Бета');assert.equal(r.team.agreed,2);assert.equal(r.team.reviewed,true);});
test('unresolved tie and all empty return actionable reasons',async()=>{await assert.rejects(group(['A','B','','','','','Z']),/поровну/);await assert.rejects(group([]),/пустой ответ/);});
test('photo skips the text-only provider',async()=>{const r=await group(['A','A','A','A','A'],true);assert.equal(r.team.agreed,2);assert.ok(!r.team.rows.some(r=>r.name==='Groq'));});
