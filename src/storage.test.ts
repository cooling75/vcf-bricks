import { describe, it, expect } from 'vitest';
import { readLocalProject, writeLocalProject, clearLocalProject, STORAGE_KEY } from './storage';
import { parseProject, serializeProject, MAX_IMPORT_BYTES } from './domain/schema';
import type { ArchitectureDocument } from './contracts';
import { addNode, updateNode } from './domain/model';
const document: ArchitectureDocument = {schemaVersion:1,id:'example',title:'Workshop',profile:'unspecified',mode:'sandbox',nodes:[],edges:[]};
function memoryStorage(): Storage {const data = new Map<string,string>(); return {get length(){return data.size},clear(){data.clear()},getItem(k){return data.get(k)??null},setItem(k,v){data.set(k,v)},removeItem(k){data.delete(k)},key(i){return [...data.keys()][i]??null}};}
const parse = parseProject;
describe('local persistence',()=>{
 it('returns no project for empty storage',()=>expect(readLocalProject(parse,memoryStorage())).toEqual({document:null,error:null}));
 it('roundtrips a project without changing it',()=>{const s=memoryStorage();expect(writeLocalProject(document,s)).toBeNull();expect(readLocalProject(parse,s).document).toEqual(document)});
 it('preserves corrupt data and reports it in English',()=>{const s=memoryStorage();s.setItem(STORAGE_KEY,'broken');const result=readLocalProject(parse,s);expect(result.document).toBeNull();expect(result.error).toBe('The local draft could not be loaded. The project file does not contain valid JSON.');expect(s.getItem(STORAGE_KEY)).toBe('broken')});
 it('reports quota failures in English',()=>{const s=memoryStorage();s.setItem=()=>{throw Error('quota')};expect(writeLocalProject(document,s)).toBe('Could not save automatically. Please export the draft as JSON.')});
 it('reports storage access failures in English',()=>{const s=memoryStorage();s.getItem=()=>{throw Error('access')};expect(readLocalProject(parse,s)).toEqual({document:null,error:'Local storage is unavailable. Please use JSON export.'})});
 it('reports clear failures in English without changing the saved draft',()=>{const s=memoryStorage();writeLocalProject(document,s);const saved=s.getItem(STORAGE_KEY);s.removeItem=()=>{throw Error('access')};expect(clearLocalProject(s)).toBe('Could not clear local storage.');expect(s.getItem(STORAGE_KEY)).toBe(saved)});
 it.each(['Neue VCF-Architektur', 'Fiktives Beispiel: VCF – Management & Workloads'])('preserves an existing German draft titled %s while saving new edits',title=>{
  const legacy:ArchitectureDocument={...document,id:'example-vcf',title,nodes:[
   {id:'example-vcf-instance',kind:'instance',label:'VCF-Instanz · Workshop',position:{x:40,y:80},size:{width:1000,height:720},config:{version:'',instances:1,notes:'Fiktiver Workshop-Baustein. Logischer Scope, keine Hosting-, Hardware- oder Dimensionierungszusage.'}},
   {id:'example-vcf-network',kind:'network',label:'Netzwerk · Büro München',parentId:'example-vcf-instance',position:{x:24,y:80},config:{version:'Version nach Rücksprache',instances:1,notes:'Übernahme unverändert. Größe später prüfen.\nEigene Annahme.'}},
  ]};
  const s=memoryStorage();const original=serializeProject(legacy);s.setItem(STORAGE_KEY,original);
  const loaded=readLocalProject(parseProject,s);expect(loaded).toEqual({document:legacy,error:null});expect(s.getItem(STORAGE_KEY)).toBe(original);
  const edited=addNode(updateNode(loaded.document!,legacy.nodes[1].id,{config:{...legacy.nodes[1].config,instances:2}}),'external-storage');
  expect(edited.title).toBe(title);expect(edited.nodes[0]).toEqual(legacy.nodes[0]);expect(edited.nodes[1]).toEqual({...legacy.nodes[1],config:{...legacy.nodes[1].config,instances:2}});expect(edited.nodes[2].label).toBe('External Storage');
  expect(writeLocalProject(edited,s)).toBeNull();expect(readLocalProject(parseProject,s)).toEqual({document:edited,error:null});expect(parseProject(s.getItem(STORAGE_KEY)!)).toEqual({ok:true,value:edited});expect(serializeProject(legacy)).toBe(original);
 });
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
