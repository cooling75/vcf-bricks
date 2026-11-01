import type { ArchitectureDocument, ParseResult } from './contracts';
import { parseProject, serializeProject } from './domain/schema';
export const STORAGE_KEY = 'vcf-bricks.project.v1';
export function readLocalProject(parse: (text:string)=>ParseResult, storage?:Storage): {document:ArchitectureDocument|null;error:string|null} {
  try { const value=(storage??window.localStorage).getItem(STORAGE_KEY); if(value===null)return {document:null,error:null}; const parsed=parse(value); return parsed.ok?{document:parsed.value,error:null}:{document:null,error:'The local draft could not be loaded. '+parsed.errors.join(' ')}; }
  catch {return {document:null,error:'Local storage is unavailable. Please use JSON export.'};}
}
export function writeLocalProject(document:ArchitectureDocument,storage?:Storage):string|null {
  try {const serialized=serializeProject(document);const parsed=parseProject(serialized);if(!parsed.ok)return parsed.errors.join(' ');(storage??window.localStorage).setItem(STORAGE_KEY,serialized);return null;}catch{return 'Could not save automatically. Please export the draft as JSON.';}
}
export function clearLocalProject(storage?:Storage):string|null {
  try {(storage??window.localStorage).removeItem(STORAGE_KEY);return null;}catch{return 'Could not clear local storage.';}
}
