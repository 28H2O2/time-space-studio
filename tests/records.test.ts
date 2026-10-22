import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecords, mergeRecords, recordsMarkdown, readRecords, writeRecords, STORAGE_KEY } from '../src/lib/records.ts';
import type { Records } from '../src/lib/records.ts';
const sample = (): Records => ({ version: 1, notes: { example: { artworkId: 'example', favorite: true, preference: 'dislike', note: '不喜欢，但线条值得借用。', tags: ['结构'], updatedAt: '2026-10-22T00:00:00Z' } }, rules: [{ id: 'rule-1', text: '地点较少时保留连续路径。', exampleIds: ['example'], createdAt: '2026-10-22T00:00:00Z' }] });
test('JSON round trip preserves preferences, favorites, tags and rules', () => { const s=sample(); assert.deepEqual(parseRecords(JSON.parse(JSON.stringify(s))),s); });
test('merge is repeatable and keeps newer local records', () => { const local=sample(), incoming=sample(); local.notes.example.updatedAt='2026-10-23T00:00:00Z'; local.notes.example.note='较新的判断'; incoming.notes.second={...incoming.notes.example,artworkId:'second'}; const merged=mergeRecords(local,incoming); assert.equal(merged.notes.example.note,'较新的判断'); assert.equal(Object.keys(merged.notes).length,2); assert.deepEqual(mergeRecords(merged,incoming),merged); });
test('malformed and prototype-key backups are rejected without modifying source', () => { const s=sample(); assert.throws(()=>parseRecords({...s,version:2})); assert.throws(()=>parseRecords({...s,notes:{...s.notes,constructor:s.notes.example}})); assert.throws(()=>parseRecords({...s,rules:[{...s.rules[0],text:3}]})); assert.equal(s.notes.example.preference,'dislike'); });
test('Markdown contains the full note and rule data', () => { const md=recordsMarkdown(sample(),[]); for(const v of ['不喜欢','收藏：是','结构','不喜欢，但线条值得借用。','地点较少时保留连续路径。','rule-1','example']) assert(md.includes(v)); });
test('browser persistence survives reread and reports quota/corrupt data failures', () => {
  const map=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>map.set(k,v)}});
  writeRecords(sample()); assert.deepEqual(readRecords(),sample());
  map.set(STORAGE_KEY,'not-json'); assert.throws(()=>readRecords());
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{setItem:()=>{throw new Error('QuotaExceededError');}}});
  assert.throws(()=>writeRecords(sample()),/QuotaExceededError/);
});
