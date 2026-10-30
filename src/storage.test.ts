import { describe, it, expect } from 'vitest';
import { readLocalProject, writeLocalProject, clearLocalProject, STORAGE_KEY } from './storage';
import { parseProject, serializeProject, MAX_IMPORT_BYTES } from './domain/schema';
import type { ArchitectureDocument, ParseResult } from './contracts';
const document: ArchitectureDocument = {schemaVersion:1,id:'example',title:'Workshop',profile:'unspecified',mode:'sandbox',nodes:[],edges:[]};
function memoryStorage(): Storage {const data = new Map<string,string>(); return {get length(){return data.size},clear(){data.clear()},getItem(k){return data.get(k)??null},setItem(k,v){data.set(k,v)},removeItem(k){data.delete(k)},key(i){return [...data.keys()][i]??null}};}
const parse = (text:string):ParseResult => {try {const value=JSON.parse(text);return value.schemaVersion===1?{ok:true,value}:{ok:false,errors:['Nicht unterstützt']}} catch{return {ok:false,errors:['Ungültiges JSON']}}};
describe('local persistence',()=>{
 it('returns no project for empty storage',()=>expect(readLocalProject(parse,memoryStorage())).toEqual({document:null,error:null}));
 it('roundtrips a project without changing it',()=>{const s=memoryStorage();expect(writeLocalProject(document,s)).toBeNull();expect(readLocalProject(parse,s).document).toEqual(document)});
 it('preserves corrupt data and reports it',()=>{const s=memoryStorage();s.setItem(STORAGE_KEY,'broken');const result=readLocalProject(parse,s);expect(result.document).toBeNull();expect(result.error).toBeTruthy();expect(s.getItem(STORAGE_KEY)).toBe('broken')});
 it('reports quota/access failures',()=>{const s=memoryStorage();s.setItem=()=>{throw Error('quota')};expect(writeLocalProject(document,s)).toBeTruthy();s.getItem=()=>{throw Error('access')};expect(readLocalProject(parse,s).error).toBeTruthy()});
 it.each(['', '   '])('rejects invalid title %j without replacing the stored document',title=>{const s=memoryStorage();writeLocalProject(document,s);const previous=s.getItem(STORAGE_KEY);expect(writeLocalProject({...document,title},s)).toBeTruthy();expect(s.getItem(STORAGE_KEY)).toBe(previous);expect(readLocalProject(parseProject,s).document).toEqual(document)});
 it('checks UTF8 bytes of the pretty export, not compact JSON, before writing',()=>{
  const s=memoryStorage();writeLocalProject(document,s);const previous=s.getItem(STORAGE_KEY);
  const large:ArchitectureDocument={...document,nodes:Array.from({length:200},(_,i)=>({id:`node-${i}`,kind:'vcenter',label:`Node ${i}`,position:{x:0,y:0},config:{version:'',instances:1,notes:''}}))};
  const base=new TextEncoder().encode(JSON.stringify(large)).byteLength;
  const chars=Math.floor((MAX_IMPORT_BYTES-1024-base)/600);
  large.nodes.forEach(n=>{n.config.notes='界'.repeat(chars)});
  expect(chars).toBeLessThanOrEqual(2000);
  expect(new TextEncoder().encode(JSON.stringify(large)).byteLength).toBeLessThan(MAX_IMPORT_BYTES);
  expect(parseProject(JSON.stringify(large)).ok).toBe(true);
  expect(serializeProject(large).length).toBeLessThan(MAX_IMPORT_BYTES);
  expect(new TextEncoder().encode(serializeProject(large)).byteLength).toBeGreaterThan(MAX_IMPORT_BYTES);
  expect(writeLocalProject(large,s)).toMatch(/1 MiB/);
  expect(s.getItem(STORAGE_KEY)).toBe(previous);
  expect(readLocalProject(parseProject,s).document).toEqual(document);
 });
 it('clears only this app key',()=>{const s=memoryStorage();s.setItem('unrelated','keep');writeLocalProject(document,s);expect(clearLocalProject(s)).toBeNull();expect(s.getItem(STORAGE_KEY)).toBeNull();expect(s.getItem('unrelated')).toBe('keep')});
});
