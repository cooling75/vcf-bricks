import { useEffect, useMemo, useRef, useState } from 'react';
import type { ArchitectureDocument, ArchitectureNode, ComponentKind, Category, Point, RelationKind } from './contracts';
import { CATALOG_DRAG_TYPE } from './contracts';
import { CATALOG, CATEGORY_LABELS, getCatalogItem } from './domain/catalog';
import { createEmptyDocument, updateNode, removeNode, duplicateNode, moveNode, resizeNode, connectNodes, removeEdge } from './domain/model';
import { EXAMPLES } from './domain/examples';
import { getHints } from './domain/hints';
import { parseProject, serializeProject, MAX_IMPORT_BYTES } from './domain/schema';
import { ArchitectureCanvas } from './editor/ArchitectureCanvas';
import { assignNode, getAbsolutePosition, getDescendantIds, getNodePath, insertNode, relocateNode } from './domain/placement';
import { StructureTree } from './ui/StructureTree';
import { readLocalProject, writeLocalProject, clearLocalProject } from './storage';
import './placement.css';

const categories: Category[] = ['boundaries','management','compute','network','kubernetes'];
const relationLabels: Record<RelationKind,string> = {contains:'Enthält', manages:'Verwaltet', 'runs-on':'Läuft auf', 'uses-network':'Nutzt Netzwerk', 'uses-storage':'Nutzt Speicher', connects:'Verbunden mit'};
const modeLabels = {'sandbox':'Spielwiese','as-is':'Ist-Architektur','to-be':'Ziel-Architektur'};

function Mark({small=false}:{small?:boolean}) {return <span className={`brand-mark ${small?'small':''}`} aria-hidden="true"><i/><i/><i/></span>}
function Icon({name}:{name:'plus'|'download'|'upload'|'copy'|'trash'|'undo'|'redo'|'close'|'help'|'layers'|'arrow'}) {
 const paths={plus:'M12 5v14M5 12h14',download:'M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5',upload:'M12 16V4m-5 5 5-5 5 5M5 17v4h14v-4',copy:'M9 9h11v11H9zM5 15H3V3h12v2',trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',undo:'M9 5 4 10l5 5M4 10h10a6 6 0 0 1 6 6',redo:'m15 5 5 5-5 5m5-5H10a6 6 0 0 0-6 6',close:'m6 6 12 12M6 18 18 6',help:'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 18h.01',layers:'m12 3 10 5-10 5L2 8zm-9 10 9 5 9-5m-18 5 9 5 9-5',arrow:'M4 12h16m-6-6 6 6-6 6'};
 return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>
}

export default function App() {
 const [initial] = useState(()=>readLocalProject(parseProject));
 const [document,setDocument]=useState<ArchitectureDocument>(()=>initial.document??structuredClone(EXAMPLES[0]?.document??createEmptyDocument()));
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [insertionTargetId,setInsertionTargetId]=useState('');
 const [focusRequest,setFocusRequest]=useState<{id:string;sequence:number}|null>(null);
 const focusSequence=useRef(0);
 const catalogDragging=useRef(false);
 const [past,setPast]=useState<ArchitectureDocument[]>([]);
 const [future,setFuture]=useState<ArchitectureDocument[]>([]);
 const [tab,setTab]=useState<'palette'|'structure'>('palette');
 const [search,setSearch]=useState('');
 const [modal,setModal]=useState<'examples'|'help'|null>(null);
 const [error,setError]=useState<string|null>(initial.error);
 const [notice,setNotice]=useState('');
 const [saveStatus,setSaveStatus]=useState('Lokal im Browser');
 const [persistEnabled,setPersistEnabled]=useState(!initial.error);
 const [protectStored,setProtectStored]=useState(!!initial.error);
 const [targetId,setTargetId]=useState('');
 const [relation,setRelation]=useState<RelationKind>('connects');
 const [showHints,setShowHints]=useState(false);
 const importRef=useRef<HTMLInputElement>(null);
 const dialogRef=useRef<HTMLDialogElement>(null);
 const selected=document.nodes.find(n=>n.id===selectedId)??null;
 const selectedCatalog=selected?getCatalogItem(selected.kind):null;
 const hints=useMemo(()=>getHints(document),[document]);
 const groups=document.nodes.filter(n=>getCatalogItem(n.kind).isBoundary);
 const descendants=selected?getDescendantIds(document,selected.id):new Set<string>();
 const targetPath=getNodePath(document,insertionTargetId||undefined);
 const componentCount=document.nodes.filter(n=>!getCatalogItem(n.kind).isBoundary).length;
 const isExample=EXAMPLES.some(e=>e.document.id===document.id);

 useEffect(()=>{
  if(!persistEnabled)return;
  setSaveStatus('Wird gespeichert …');
  const timeout=window.setTimeout(()=>{const problem=writeLocalProject(document);setSaveStatus(problem?'Nicht gespeichert':'Lokal gespeichert');if(problem)setError(problem)},250);
  return ()=>window.clearTimeout(timeout);
 },[document,persistEnabled]);
 useEffect(()=>{setTargetId('')},[selectedId]);
 useEffect(()=>{if(insertionTargetId&&!document.nodes.some(node=>node.id===insertionTargetId))setInsertionTargetId('')},[document,insertionTargetId]);
 useEffect(()=>{if(modal&&!dialogRef.current?.open)dialogRef.current?.showModal();else if(!modal&&dialogRef.current?.open)dialogRef.current.close()},[modal]);

 function canReplace(){if(protectStored&&!window.confirm('Der bisherige lokale Stand konnte nicht gelesen werden. Trotzdem mit diesem Entwurf überschreiben?'))return false;setProtectStored(false);return true;}
 function commit(next:ArchitectureDocument):boolean{if(next===document)return false;const checked=parseProject(serializeProject(next));if(!checked.ok){setError(checked.errors.join(' '));return false}if(!canReplace())return false;setPast(p=>[...p.slice(-39),document]);setFuture([]);setDocument(next);setPersistEnabled(true);setError(null);setNotice('');return true;}
 function focus(id:string){setFocusRequest({id,sequence:++focusSequence.current})}
 function selectNode(id:string|null){setSelectedId(id);const node=document.nodes.find(item=>item.id===id);if(node)setInsertionTargetId(getCatalogItem(node.kind).isBoundary?node.id:node.parentId??'')}
 function undo(){if(!past.length)return;setFuture(f=>[document,...f]);setDocument(past[past.length-1]);setPast(p=>p.slice(0,-1));setSelectedId(null)}
 function redo(){if(!future.length)return;setPast(p=>[...p,document]);setDocument(future[0]);setFuture(f=>f.slice(1));setSelectedId(null)}
 function patch(node:ArchitectureNode,change:Partial<ArchitectureNode>){commit(updateNode(document,node.id,change));}
 function add(kind:ComponentKind,position?:Point,parentId?:string){const parent=position?parentId:insertionTargetId||undefined;const next=insertNode(document,kind,parent,position);const node=next.nodes.find(item=>!document.nodes.some(old=>old.id===item.id));if(!node){setError('Hier ist kein Platz für einen weiteren Baustein. Bitte einen anderen Rahmen wählen.');return}if(!commit(next))return;setSelectedId(node.id);setInsertionTargetId(getCatalogItem(node.kind).isBoundary?node.id:node.parentId??'');if(!position)focus(node.id);setNotice(`${node.label} hinzugefügt – ${getNodePath(next,node.parentId).map(item=>item.label).join(' → ')||'Baufläche'}.`)}
 function relocate(id:string,position:Point,parentId?:string){const next=relocateNode(document,id,position,parentId);if(next===document){const node=document.nodes.find(item=>item.id===id);const current=getAbsolutePosition(document,id);if(node&&(node.parentId!==parentId||current.x!==position.x||current.y!==position.y))setError('Verschieben ist hier nicht möglich. Bitte einen anderen Rahmen oder eine andere Position wählen.');return}if(commit(next)){setSelectedId(id);const node=next.nodes.find(item=>item.id===id)!;setInsertionTargetId(getCatalogItem(node.kind).isBoundary?node.id:node.parentId??'');if(document.nodes.find(item=>item.id===id)?.parentId!==parentId)setNotice('Zuordnung geändert. Rückgängig macht Verschieben und Zuordnung gemeinsam rückgängig.')}}
 function assign(id:string,parentId?:string){const next=assignNode(document,id,parentId);if(next===document){if(document.nodes.find(item=>item.id===id)?.parentId!==parentId)setError('Zuordnung ist hier nicht möglich. Bitte einen anderen Rahmen wählen.');return}if(commit(next)){setInsertionTargetId(parentId??'');focus(id);setNotice(`Baustein zugeordnet: ${getNodePath(next,parentId).map(item=>item.label).join(' → ')||'Baufläche'}.`)}}
 function removeSelected(){if(!selected)return;if(selectedCatalog?.isBoundary&&!window.confirm('Diese Gruppe einschließlich ihrer enthaltenen Komponenten löschen?'))return;commit(removeNode(document,selected.id));setSelectedId(null)}
 function duplicateSelected(){if(!selected)return;const next=duplicateNode(document,selected.id);const newNode=next.nodes.find(n=>!document.nodes.some(old=>old.id===n.id));if(commit(next)&&newNode){selectNode(newNode.id);focus(newNode.id)}}
 function newDocument(){if(document.nodes.length&&!window.confirm('Neuen leeren Entwurf beginnen? Der aktuelle Stand kann vorher als JSON exportiert werden.'))return;if(!commit(createEmptyDocument()))return;setSelectedId(null);setInsertionTargetId('');setNotice('Leerer Entwurf. Wähle links deinen ersten Baustein.')}
 function loadExample(id:string){const example=EXAMPLES.find(e=>e.id===id);if(!example)return;if(document.nodes.length&&!window.confirm('Beispiel laden und aktuellen Entwurf ersetzen? Bitte bei Bedarf vorher exportieren.'))return;if(!commit(structuredClone(example.document)))return;setSelectedId(null);setInsertionTargetId('');setModal(null);setNotice('Illustratives Beispiel geladen – keine offizielle Referenzarchitektur.')}
 function exportJson(){const blob=new Blob([serializeProject(document)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=window.document.createElement('a');a.href=url;a.download=(document.title.trim().replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,70)||'vcf-bricks')+'.json';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('JSON exportiert. Die Datei enthält deinen vollständigen Entwurf.')}
 async function importFile(file:File){try {if(file.size>MAX_IMPORT_BYTES){setError('Diese Datei ist zu groß. Bitte einen kleineren JSON-Entwurf verwenden.');return}const parsed=parseProject(await file.text());if(!parsed.ok){setError(parsed.errors.join(' '));return}if(document.nodes.length&&!window.confirm('Geprüften Entwurf importieren und aktuellen Stand ersetzen?'))return;if(!commit(parsed.value))return;setSelectedId(null);setInsertionTargetId('');setNotice('Entwurf erfolgreich importiert.')}catch{setError('Die Datei konnte nicht gelesen werden.')}finally{if(importRef.current)importRef.current.value=''}}
 function clearLocal(){if(!window.confirm('Lokal gespeicherten Entwurf und aktuelle Baufläche löschen? Exportierte Dateien bleiben erhalten.'))return;const problem=clearLocalProject();if(problem){setError(problem);return}setPersistEnabled(false);setProtectStored(false);setDocument(createEmptyDocument());setPast([]);setFuture([]);setSelectedId(null);setInsertionTargetId('');setError(null);setNotice('Lokale Daten gelöscht.');setSaveStatus('Kein lokaler Entwurf')}
 function connect(source:string,target:string,kind:RelationKind='connects'){commit(connectNodes(document,source,target,kind));setTargetId('')}
 const connections=selected?document.edges.filter(e=>e.source===selected.id||e.target===selected.id):[];
 const breadcrumbs:string[]=[];let ancestor=selected;const seen=new Set<string>();while(ancestor&&!seen.has(ancestor.id)){seen.add(ancestor.id);breadcrumbs.unshift(ancestor.label);ancestor=document.nodes.find(n=>n.id===ancestor?.parentId)??null}

 return <div className="app-shell">
  <header className="app-header">
   <a className="brand" href={import.meta.env.BASE_URL} aria-label="VCF Bricks Startseite"><Mark/><span><strong>vcf<span className="brand-dot">.</span>bricks</strong><small>ARCHITECTURE PLAYGROUND</small></span></a>
   <div className="header-caption">Große Plattformen. <span>Klare Bausteine.</span></div>
   <div className="header-actions"><span className="local-badge"><i/> Nur lokal</span><button className="icon-button header-help" aria-label="Hilfe öffnen" onClick={()=>setModal('help')}><Icon name="help"/></button><a className="repo-link" href="https://github.com/cooling75/vcf-bricks" target="_blank" rel="noreferrer">GitHub ↗</a></div>
  </header>
  <section className="project-toolbar" aria-label="Projektwerkzeuge">
   <div className="project-heading"><span className="eyebrow">DEIN ENTWURF</span><input aria-label="Projektname" value={document.title} maxLength={120} onChange={e=>commit({...document,title:e.target.value})}/></div>
   <label className="compact-select"><span className="sr-only">Entwurfsmodus</span><select aria-label="Entwurfsmodus" value={document.mode} onChange={e=>commit({...document,mode:e.target.value as ArchitectureDocument['mode']})}>{Object.entries(modeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label className="compact-select profile-select"><span className="sr-only">VCF-Profil</span><select aria-label="VCF-Profil" value={document.profile} onChange={e=>commit({...document,profile:e.target.value as ArchitectureDocument['profile']})}><option value="unspecified">VCF · versionsoffen</option><option value="vcf-9.0">VCF 9.0</option><option value="vcf-9.1">VCF 9.1</option></select></label>
   <div className="toolbar-spacer"/>
   <button className="button subtle" onClick={newDocument} aria-label="Neuer Entwurf"><Icon name="plus"/><span>Neu</span></button>
   <button className="button subtle" onClick={()=>setModal('examples')}><Icon name="layers"/>Beispiele</button>
   <div className="toolbar-divider"/>
   <button className="button subtle" aria-label="JSON importieren" onClick={()=>importRef.current?.click()}><Icon name="upload"/><span>Import</span></button>
   <button className="button primary" aria-label="JSON exportieren" onClick={exportJson}><Icon name="download"/><span>Export JSON</span></button>
   <input ref={importRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="JSON-Datei auswählen" onChange={e=>{const file=e.target.files?.[0];if(file)void importFile(file)}}/>
  </section>
  {(error||notice)&&<div className={`message ${error?'error':'info'}`} role={error?'alert':'status'}><span>{error??notice}</span><button aria-label="Meldung schließen" onClick={()=>{setError(null);setNotice('')}}><Icon name="close"/></button></div>}
  <main className="workspace">
   <aside className="palette-panel" aria-label="Komponentenkatalog">
    <div className="panel-title"><h1>Bausteine</h1><span className="count-chip">{CATALOG.length}</span></div>
    <p className="panel-description">Bausteine klicken oder in einen Rahmen ziehen.</p>
    <div className="insertion-target"><label htmlFor="insertion-target">Einfügen in</label><select id="insertion-target" value={insertionTargetId} onChange={e=>setInsertionTargetId(e.target.value)}><option value="">Baufläche (ohne Rahmen)</option>{groups.map(group=><option key={group.id} value={group.id}>{getNodePath(document,group.id).map(node=>node.label).join(" → ")}</option>)}</select><p title={targetPath.map(node=>node.label).join(" → ")}>{targetPath.length?targetPath.map(node=>node.label).join(" → "):"Baufläche · frei platzieren"}</p><small>Klick: freier Platz im Ziel. Ziehen: Ziel direkt auf der Baufläche wählen.</small></div>
    <div className="panel-tabs" role="group" aria-label="Linke Seitenleiste"><button className={tab==='palette'?'active':''} onClick={()=>setTab('palette')}>Katalog</button><button className={tab==='structure'?'active':''} onClick={()=>setTab('structure')}>Struktur</button></div>
    {tab==='palette'?<><label className="search-field"><span className="sr-only">Bausteine suchen</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input placeholder="Baustein suchen …" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <div className="palette-scroll">{categories.map(category=>{const items=CATALOG.filter(c=>c.category===category&&(c.label+' '+c.description).toLowerCase().includes(search.toLowerCase()));return items.length?<section className="catalog-category" key={category}><h2>{CATEGORY_LABELS[category]}</h2>{items.map(item=><button className={`catalog-item ${item.isBoundary?'boundary-item':''}`} key={item.kind} aria-label={`${item.label} hinzufügen`} title={item.description} draggable onDragStart={e=>{catalogDragging.current=true;e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData(CATALOG_DRAG_TYPE,item.kind)}} onDragEnd={()=>{window.setTimeout(()=>{catalogDragging.current=false},0)}} onClick={()=>{if(!catalogDragging.current)add(item.kind)}} style={{'--item-color':item.color} as React.CSSProperties}><span className="catalog-icon">{item.shortLabel}</span><span className="catalog-text"><strong>{item.label}</strong><small>{item.isBoundary?'Farbiger Rahmen':item.description}</small></span><span className="catalog-add"><Icon name="plus"/></span></button>)}</section>:null})}</div></>:
    <div className="structure-scroll"><p className="structure-help">Struktur aufklappen und Baustein fokussieren.</p>{document.nodes.length===0?<p className="empty-list">Noch keine Bausteine.</p>:<StructureTree nodes={document.nodes} selectedId={selectedId} onSelect={id=>{selectNode(id);focus(id)}}/>}</div>}
    <div className="palette-bottom"><span className="tiny-squares"><i/><i/><i/></span><p>Rahmen grenzen ab.<br/>Komponenten machen es konkret.</p></div>
   </aside>
   <section className="canvas-panel" aria-label="Architektur-Baufläche">
    <div className="canvas-toolbar"><div className="canvas-title"><span className="status-dot"/><strong>{modeLabels[document.mode]}</strong>{isExample&&<span className="example-chip">Illustratives Beispiel</span>}</div><div className="history-actions"><button className="icon-button" aria-label="Rückgängig" disabled={!past.length} onClick={undo}><Icon name="undo"/></button><button className="icon-button" aria-label="Wiederholen" disabled={!future.length} onClick={redo}><Icon name="redo"/></button></div></div>
    <div className="canvas-wrapper"><ArchitectureCanvas document={document} selectedId={selectedId} onSelect={selectNode} insertionTargetId={insertionTargetId||null} onPlace={(kind,position,parentId)=>add(kind,position,parentId)} onRelocate={relocate} focusRequest={focusRequest} onMove={(id,position)=>commit(moveNode(document,id,position))} onResize={(id,size)=>commit(resizeNode(document,id,size))} onConnect={(source,target)=>connect(source,target)} onRemoveEdge={id=>commit(removeEdge(document,id))}/>
    {!document.nodes.length&&<div className="canvas-empty"><Mark/><span className="eyebrow">DEINE CLOUD BEGINNT HIER</span><h2>Stein für Stein.<br/>Eine klare Architektur.</h2><p>Füge links eine Fleet hinzu oder starte mit einem Beispiel.</p><button className="button primary" onClick={()=>setModal('examples')}>Beispiel auswählen<Icon name="arrow"/></button></div>}
    </div>
    <div className="canvas-status"><span>{componentCount} Komponenten</span><span>{groups.length} {groups.length===1?'Rahmen':'Rahmen'}</span><span>{document.edges.length} {document.edges.length===1?'Verbindung':'Verbindungen'}</span><span className="save-status"><i className={saveStatus==='Nicht gespeichert'?'failed':''}/>{saveStatus}</span></div>
   </section>
   <aside className="inspector-panel" aria-label="Eigenschaften">
    <div className="panel-title"><h2>Eigenschaften</h2>{selected&&<button className="icon-button" aria-label="Auswahl aufheben" onClick={()=>setSelectedId(null)}><Icon name="close"/></button>}</div>
    {selected&&selectedCatalog?<div className="inspector-scroll">
     <div className="selected-card" style={{'--item-color':selectedCatalog.color} as React.CSSProperties}><span className="selected-icon">{selectedCatalog.shortLabel}</span><div><span className="eyebrow">{selectedCatalog.isBoundary?'STRUKTUR':'KOMPONENTE'}</span><h3>{selectedCatalog.label}</h3></div></div>
     <p className="selected-description">{selectedCatalog.description}</p>
     <div className="field"><label htmlFor="node-name">Komponentenname</label><input id="node-name" maxLength={120} value={selected.label} onChange={e=>patch(selected,{label:e.target.value})}/></div>
     <div className="field-row"><div className="field"><label htmlFor="node-version">Version</label><input id="node-version" placeholder="z. B. 9.0" maxLength={80} value={selected.config.version} onChange={e=>patch(selected,{config:{...selected.config,version:e.target.value}})}/></div><div className="field"><label htmlFor="node-count">Instanzen</label><input id="node-count" type="number" min="1" max="999" value={selected.config.instances} onChange={e=>{const value=Number(e.target.value);if(Number.isInteger(value)&&value>=1&&value<=999)patch(selected,{config:{...selected.config,instances:value}})}}/></div></div>
     <div className="field"><label htmlFor="node-parent">Zugehöriger Rahmen</label><select id="node-parent" value={selected.parentId??''} onChange={e=>assign(selected.id,e.target.value||undefined)}><option value="">Baufläche (ohne Rahmen)</option>{groups.filter(g=>!descendants.has(g.id)).map(g=><option key={g.id} value={g.id}>{getNodePath(document,g.id).map(node=>node.label).join(' → ')}</option>)}</select><small>Visuelle Zuordnung, kein Nachweis des tatsächlichen Ausführungsorts.</small></div>
     <div className="field"><label htmlFor="node-notes">Notizen</label><textarea id="node-notes" placeholder="Rolle, Annahmen, Gesprächsnotizen …" maxLength={2000} rows={3} value={selected.config.notes} onChange={e=>patch(selected,{config:{...selected.config,notes:e.target.value}})}/></div>
     <details className="position-details"><summary>Position bearbeiten</summary><div className="field-row"><div className="field"><label htmlFor="node-x">Position X</label><input id="node-x" type="number" value={selected.position.x} min="-100000" max="100000" onChange={e=>{const x=Number(e.target.value);if(Number.isFinite(x))commit(moveNode(document,selected.id,{...selected.position,x}))}}/></div><div className="field"><label htmlFor="node-y">Position Y</label><input id="node-y" type="number" value={selected.position.y} min="-100000" max="100000" onChange={e=>{const y=Number(e.target.value);if(Number.isFinite(y))commit(moveNode(document,selected.id,{...selected.position,y}))}}/></div></div></details>
     <div className="inspector-actions"><button className="button subtle" onClick={duplicateSelected}><Icon name="copy"/>Duplizieren</button><button className="button danger subtle" aria-label="Komponente löschen" onClick={removeSelected}><Icon name="trash"/>Löschen</button></div>
     <details className="connection-section deferred-connections"><summary>Kommunikationsbeziehungen (optional)</summary><h3>Bestehende Beziehungen <span>{connections.length}</span></h3><div className="field"><label htmlFor="connection-target">Verbindungsziel</label><select id="connection-target" value={targetId} onChange={e=>setTargetId(e.target.value)}><option value="">Komponente wählen …</option>{document.nodes.filter(n=>n.id!==selected.id).map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></div><div className="field"><label htmlFor="connection-type">Beziehung</label><select id="connection-type" value={relation} onChange={e=>setRelation(e.target.value as RelationKind)}>{Object.entries(relationLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></div><button className="button outlined full-width" disabled={!targetId} onClick={()=>connect(selected.id,targetId,relation)}><Icon name="plus"/>Verbindung hinzufügen</button><ul className="connection-list">{connections.map(edge=><li key={edge.id}><span><small>{edge.source===selected.id?'→':'←'} {relationLabels[edge.kind]}</small>{document.nodes.find(n=>n.id===(edge.source===selected.id?edge.target:edge.source))?.label}</span><button className="icon-button" aria-label="Verbindung entfernen" onClick={()=>commit(removeEdge(document,edge.id))}><Icon name="close"/></button></li>)}</ul></details>
    </div>:<div className="inspector-empty"><div className="cursor-illustration">↖</div><h3>Jeder Baustein<br/>erzählt seine Geschichte.</h3><p>Wähle eine Komponente oder einen Rahmen, um Eigenschaften und Beziehungen zu bearbeiten.</p><div className="inspector-tip"><strong>Kleiner Tipp</strong><p>„Einfügen in“ zeigt das Ziel für neue Bausteine. Beim Ziehen wird der Zielrahmen hervorgehoben. Über „Struktur“ erreichst du jedes Element auch per Tastatur.</p></div></div>}
    <div className="hints-block"><button className="hints-toggle" onClick={()=>setShowHints(!showHints)} aria-expanded={showHints}><span>Modellhinweise</span><span className="hint-count">{hints.length}</span><span>{showHints?'−':'+'}</span></button>{showHints&&<div className="hints-list">{hints.length?hints.map(h=><p key={h.id} className={h.severity}><span>{h.severity==='warning'?'Prüfen':'Hinweis'}</span>{h.message}</p>):<p>Keine zusätzlichen Hinweise. Das ist keine Bestätigung der Supportfähigkeit.</p>}</div>}</div>
   </aside>
  </main>
  <footer className="app-footer"><span>Ein Gesprächswerkzeug für VMware Cloud Foundation · <strong>Keine offizielle Architekturvalidierung.</strong></span><button onClick={clearLocal}>Lokale Daten löschen</button><span className="version-label">v0.1 · Workshop edition</span></footer>
  <dialog ref={dialogRef} onCancel={()=>setModal(null)} className="app-dialog" aria-labelledby="dialog-title">
   <div className="dialog-header"><span className="eyebrow">VCF BRICKS</span><button className="icon-button" aria-label="Dialog schließen" onClick={()=>setModal(null)}><Icon name="close"/></button></div>
   {modal==='examples'?<><h2 id="dialog-title">Ein guter Anfang.</h2><p>Wähle eine generische Gesprächsvorlage und passe sie an deinen Aufbau an.</p><div className="example-grid">{EXAMPLES.map((example,i)=><article className="example-card" key={example.id}><div className={`mini-architecture mini-${i}`} aria-hidden="true"><div><i/><i/><i/></div><div><i/><i/></div></div><span className="eyebrow">{i===0?'PLATTFORM':'KUBERNETES'}</span><h3>{example.name}</h3><p>{example.description}</p><button className="button primary" aria-label={`Beispiel laden: ${example.name}`} onClick={()=>loadExample(example.id)}>Beispiel laden<Icon name="arrow"/></button></article>)}</div><p className="dialog-footnote">Illustrative Beispiele – keine offizielle Referenzarchitektur und keine Support- oder Sizing-Prüfung.</p></>:<><h2 id="dialog-title">Architektur gemeinsam begreifbar machen.</h2><p>VCF Bricks überträgt die Idee physischer Komponenten-Bausteine in ein Browser-Workshopwerkzeug.</p><ol className="help-steps"><li><strong>Rahmen setzen.</strong> Fleet, Instanz und Domains grenzen logische Bereiche farbig ab.</li><li><strong>Einfügeziel wählen.</strong> Unter „Einfügen in“ den Rahmen wählen und einen Baustein anklicken – oder direkt aus dem Katalog auf die Baufläche ziehen.</li><li><strong>Platzieren und zuordnen.</strong> Bausteine in einen anderen Rahmen ziehen oder rechts die Zugehörigkeit ändern. Der Strukturbaum hilft beim Navigieren.</li><li><strong>Entwurf mitnehmen.</strong> JSON exportieren und später wieder importieren.</li></ol><h3>Deine Daten bleiben im Browser.</h3><p>Es gibt keine Konten, Telemetrie oder Verbindung zu vCenter/NSX. Der lokale Speicher ist unverschlüsselt und bleibt nach dem Schließen des Tabs erhalten. Auf einem gemeinsam benutzten Gerät bitte anschließend die lokalen Daten löschen. Keine Zugangsdaten oder vertraulichen Kundeninformationen eingeben.</p><h3>Bewusst ein Gesprächswerkzeug.</h3><p>VKS steht für vSphere Kubernetes Service. Supervisor, vSphere Namespaces und Workloadcluster sind unterschiedliche logische Komponenten. Rahmen und Linien sind keine garantierte Darstellung des tatsächlichen Ausführungsorts. Anzahl und Versionen sind beschreibend, kein Sizing.</p><p className="dialog-footnote">Unabhängiger Prototyp; kein offizielles Produkt von VMware, Broadcom oder SVA. Der Hostinganbieter verarbeitet übliche Seitenabrufe.</p></>}
  </dialog>
  <div className="sr-only" aria-live="polite">{selected?`${selected.label} ausgewählt`:'Keine Komponente ausgewählt'}{breadcrumbs.length?': '+breadcrumbs.join(' / '):''}</div>
 </div>
}
