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
const relationLabels: Record<RelationKind,string> = {contains:'Contains', manages:'Manages', 'runs-on':'Runs on', 'uses-network':'Uses network', 'uses-storage':'Uses storage', connects:'Connects to'};
const modeLabels = {'sandbox':'Sandbox','as-is':'Current architecture','to-be':'Target architecture'};

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
 const [saveStatus,setSaveStatus]=useState('Stored in this browser');
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
  setSaveStatus('Saving …');
  const timeout=window.setTimeout(()=>{const problem=writeLocalProject(document);setSaveStatus(problem?'Not saved':'Saved locally');if(problem)setError(problem)},250);
  return ()=>window.clearTimeout(timeout);
 },[document,persistEnabled]);
 useEffect(()=>{setTargetId('')},[selectedId]);
 useEffect(()=>{if(insertionTargetId&&!document.nodes.some(node=>node.id===insertionTargetId))setInsertionTargetId('')},[document,insertionTargetId]);
 useEffect(()=>{if(modal&&!dialogRef.current?.open)dialogRef.current?.showModal();else if(!modal&&dialogRef.current?.open)dialogRef.current.close()},[modal]);

 function canReplace(){if(protectStored&&!window.confirm('The previous local draft could not be read. Overwrite it with this draft anyway?'))return false;setProtectStored(false);return true;}
 function commit(next:ArchitectureDocument):boolean{if(next===document)return false;const checked=parseProject(serializeProject(next));if(!checked.ok){setError(checked.errors.join(' '));return false}if(!canReplace())return false;setPast(p=>[...p.slice(-39),document]);setFuture([]);setDocument(next);setPersistEnabled(true);setError(null);setNotice('');return true;}
 function focus(id:string){setFocusRequest({id,sequence:++focusSequence.current})}
 function selectNode(id:string|null){setSelectedId(id);const node=document.nodes.find(item=>item.id===id);if(node)setInsertionTargetId(getCatalogItem(node.kind).isBoundary?node.id:node.parentId??'')}
 function undo(){if(!past.length)return;setFuture(f=>[document,...f]);setDocument(past[past.length-1]);setPast(p=>p.slice(0,-1));setSelectedId(null)}
 function redo(){if(!future.length)return;setPast(p=>[...p,document]);setDocument(future[0]);setFuture(f=>f.slice(1));setSelectedId(null)}
 function patch(node:ArchitectureNode,change:Partial<ArchitectureNode>){commit(updateNode(document,node.id,change));}
 function add(kind:ComponentKind,position?:Point,parentId?:string){const parent=position?parentId:insertionTargetId||undefined;const next=insertNode(document,kind,parent,position);const node=next.nodes.find(item=>!document.nodes.some(old=>old.id===item.id));if(!node){setError('There is no room for another component here. Choose a different frame.');return}if(!commit(next))return;setSelectedId(node.id);setInsertionTargetId(getCatalogItem(node.kind).isBoundary?node.id:node.parentId??'');if(!position)focus(node.id);setNotice(`${node.label} added – ${getNodePath(next,node.parentId).map(item=>item.label).join(' → ')||'Canvas'}.`)}
 function relocate(id:string,position:Point,parentId?:string){const next=relocateNode(document,id,position,parentId);if(next===document){const node=document.nodes.find(item=>item.id===id);const current=getAbsolutePosition(document,id);if(node&&(node.parentId!==parentId||current.x!==position.x||current.y!==position.y))setError('Cannot move this component here. Choose a different frame or position.');return}if(commit(next)){setSelectedId(id);const node=next.nodes.find(item=>item.id===id)!;setInsertionTargetId(getCatalogItem(node.kind).isBoundary?node.id:node.parentId??'');if(document.nodes.find(item=>item.id===id)?.parentId!==parentId)setNotice('Assignment changed. Undo reverts both the move and the assignment.')}}
 function assign(id:string,parentId?:string){const next=assignNode(document,id,parentId);if(next===document){if(document.nodes.find(item=>item.id===id)?.parentId!==parentId)setError('Cannot assign this component here. Choose a different frame.');return}if(commit(next)){setInsertionTargetId(parentId??'');focus(id);setNotice(`Component assigned: ${getNodePath(next,parentId).map(item=>item.label).join(' → ')||'Canvas'}.`)}}
 function removeSelected(){if(!selected)return;if(selectedCatalog?.isBoundary&&!window.confirm('Delete this group and all its components?'))return;commit(removeNode(document,selected.id));setSelectedId(null)}
 function duplicateSelected(){if(!selected)return;const next=duplicateNode(document,selected.id);const newNode=next.nodes.find(n=>!document.nodes.some(old=>old.id===n.id));if(commit(next)&&newNode){selectNode(newNode.id);focus(newNode.id)}}
 function newDocument(){if(document.nodes.length&&!window.confirm('Start a new empty draft? You can export the current draft as JSON first.'))return;if(!commit(createEmptyDocument()))return;setSelectedId(null);setInsertionTargetId('');setNotice('Empty draft. Choose your first component from the catalog.')}
 function loadExample(id:string){const example=EXAMPLES.find(e=>e.id===id);if(!example)return;if(document.nodes.length&&!window.confirm('Load this example and replace the current draft? Export your draft first if you want to keep it.'))return;if(!commit(structuredClone(example.document)))return;setSelectedId(null);setInsertionTargetId('');setModal(null);setNotice('Illustrative example loaded — not an official reference architecture.')}
 function exportJson(){const blob=new Blob([serializeProject(document)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=window.document.createElement('a');a.href=url;a.download=(document.title.trim().replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,70)||'vcf-bricks')+'.json';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('JSON exported. The file contains your complete draft.')}
 async function importFile(file:File){try {if(file.size>MAX_IMPORT_BYTES){setError('This file is too large. Choose a smaller JSON draft.');return}const parsed=parseProject(await file.text());if(!parsed.ok){setError(parsed.errors.join(' '));return}if(document.nodes.length&&!window.confirm('Import the validated draft and replace the current draft?'))return;if(!commit(parsed.value))return;setSelectedId(null);setInsertionTargetId('');setNotice('Draft imported successfully.')}catch{setError('The file could not be read.')}finally{if(importRef.current)importRef.current.value=''}}
 function clearLocal(){if(!window.confirm('Delete the locally saved draft and clear the canvas? Exported files will not be affected.'))return;const problem=clearLocalProject();if(problem){setError(problem);return}setPersistEnabled(false);setProtectStored(false);setDocument(createEmptyDocument());setPast([]);setFuture([]);setSelectedId(null);setInsertionTargetId('');setError(null);setNotice('Local data cleared.');setSaveStatus('No local draft')}
 function connect(source:string,target:string,kind:RelationKind='connects'){commit(connectNodes(document,source,target,kind));setTargetId('')}
 const connections=selected?document.edges.filter(e=>e.source===selected.id||e.target===selected.id):[];
 const breadcrumbs:string[]=[];let ancestor=selected;const seen=new Set<string>();while(ancestor&&!seen.has(ancestor.id)){seen.add(ancestor.id);breadcrumbs.unshift(ancestor.label);ancestor=document.nodes.find(n=>n.id===ancestor?.parentId)??null}

 return <div className="app-shell">
  <header className="app-header">
   <a className="brand" href={import.meta.env.BASE_URL} aria-label="VCF Bricks home"><Mark/><span><strong>vcf<span className="brand-dot">.</span>bricks</strong><small>ARCHITECTURE PLAYGROUND</small></span></a>
   <div className="header-caption">Big platforms. <span>Clear building blocks.</span></div>
   <div className="header-actions"><span className="local-badge"><i/> Local only</span><button className="icon-button header-help" aria-label="Open help" onClick={()=>setModal('help')}><Icon name="help"/></button><a className="repo-link" href="https://github.com/cooling75/vcf-bricks" target="_blank" rel="noreferrer">GitHub ↗</a></div>
  </header>
  <section className="project-toolbar" aria-label="Project tools">
   <div className="project-heading"><span className="eyebrow">YOUR DRAFT</span><input aria-label="Project name" value={document.title} maxLength={120} onChange={e=>commit({...document,title:e.target.value})}/></div>
   <label className="compact-select"><span className="sr-only">Draft mode</span><select aria-label="Draft mode" value={document.mode} onChange={e=>commit({...document,mode:e.target.value as ArchitectureDocument['mode']})}>{Object.entries(modeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label className="compact-select profile-select"><span className="sr-only">VCF profile</span><select aria-label="VCF profile" value={document.profile} onChange={e=>commit({...document,profile:e.target.value as ArchitectureDocument['profile']})}><option value="unspecified">VCF · version-neutral</option><option value="vcf-9.0">VCF 9.0</option><option value="vcf-9.1">VCF 9.1</option></select></label>
   <div className="toolbar-spacer"/>
   <button className="button subtle" onClick={newDocument} aria-label="New draft"><Icon name="plus"/><span>New</span></button>
   <button className="button subtle" onClick={()=>setModal('examples')}><Icon name="layers"/>Examples</button>
   <div className="toolbar-divider"/>
   <button className="button subtle" aria-label="Import JSON" onClick={()=>importRef.current?.click()}><Icon name="upload"/><span>Import</span></button>
   <button className="button primary" aria-label="Export JSON" onClick={exportJson}><Icon name="download"/><span>Export JSON</span></button>
   <input ref={importRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="Choose JSON file" onChange={e=>{const file=e.target.files?.[0];if(file)void importFile(file)}}/>
  </section>
  {(error||notice)&&<div className={`message ${error?'error':'info'}`} role={error?'alert':'status'}><span>{error??notice}</span><button aria-label="Dismiss message" onClick={()=>{setError(null);setNotice('')}}><Icon name="close"/></button></div>}
  <main className="workspace">
   <aside className="palette-panel" aria-label="Component catalog">
    <div className="panel-title"><h1>Components</h1><span className="count-chip">{CATALOG.length}</span></div>
    <p className="panel-description">Click a component or drag it into a frame.</p>
    <div className="insertion-target"><label htmlFor="insertion-target">Insert into</label><select id="insertion-target" value={insertionTargetId} onChange={e=>setInsertionTargetId(e.target.value)}><option value="">Canvas (no frame)</option>{groups.map(group=><option key={group.id} value={group.id}>{getNodePath(document,group.id).map(node=>node.label).join(" → ")}</option>)}</select><p title={targetPath.map(node=>node.label).join(" → ")}>{targetPath.length?targetPath.map(node=>node.label).join(" → "):"Canvas · free placement"}</p><small>Click: use available space in the target. Drag: choose a target on the canvas.</small></div>
    <div className="panel-tabs" role="group" aria-label="Left sidebar"><button className={tab==='palette'?'active':''} onClick={()=>setTab('palette')}>Catalog</button><button className={tab==='structure'?'active':''} onClick={()=>setTab('structure')}>Structure</button></div>
    {tab==='palette'?<><label className="search-field"><span className="sr-only">Search components</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input placeholder="Search components …" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <div className="palette-scroll">{categories.map(category=>{const items=CATALOG.filter(c=>c.category===category&&(c.label+' '+c.description).toLowerCase().includes(search.toLowerCase()));return items.length?<section className="catalog-category" key={category}><h2>{CATEGORY_LABELS[category]}</h2>{items.map(item=><button className={`catalog-item ${item.isBoundary?'boundary-item':''}`} key={item.kind} aria-label={`Add ${item.label}`} title={item.description} draggable onDragStart={e=>{catalogDragging.current=true;e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData(CATALOG_DRAG_TYPE,item.kind)}} onDragEnd={()=>{window.setTimeout(()=>{catalogDragging.current=false},0)}} onClick={()=>{if(!catalogDragging.current)add(item.kind)}} style={{'--item-color':item.color} as React.CSSProperties}><span className="catalog-icon">{item.shortLabel}</span><span className="catalog-text"><strong>{item.label}</strong><small>{item.isBoundary?'Colored frame':item.description}</small></span><span className="catalog-add"><Icon name="plus"/></span></button>)}</section>:null})}</div></>:
    <div className="structure-scroll"><p className="structure-help">Expand the structure and focus a component.</p>{document.nodes.length===0?<p className="empty-list">No components yet.</p>:<StructureTree nodes={document.nodes} selectedId={selectedId} onSelect={id=>{selectNode(id);focus(id)}}/>}</div>}
    <div className="palette-bottom"><span className="tiny-squares"><i/><i/><i/></span><p>Frames define boundaries.<br/>Components bring them to life.</p></div>
   </aside>
   <section className="canvas-panel" aria-label="Architecture canvas">
    <div className="canvas-toolbar"><div className="canvas-title"><span className="status-dot"/><strong>{modeLabels[document.mode]}</strong>{isExample&&<span className="example-chip">Illustrative example</span>}</div><div className="history-actions"><button className="icon-button" aria-label="Undo" disabled={!past.length} onClick={undo}><Icon name="undo"/></button><button className="icon-button" aria-label="Redo" disabled={!future.length} onClick={redo}><Icon name="redo"/></button></div></div>
    <div className="canvas-wrapper"><ArchitectureCanvas document={document} selectedId={selectedId} onSelect={selectNode} insertionTargetId={insertionTargetId||null} onPlace={(kind,position,parentId)=>add(kind,position,parentId)} onRelocate={relocate} focusRequest={focusRequest} onMove={(id,position)=>commit(moveNode(document,id,position))} onResize={(id,size)=>commit(resizeNode(document,id,size))} onConnect={(source,target)=>connect(source,target)} onRemoveEdge={id=>commit(removeEdge(document,id))}/>
    {!document.nodes.length&&<div className="canvas-empty"><Mark/><span className="eyebrow">YOUR CLOUD STARTS HERE</span><h2>Brick by brick.<br/>A clear architecture.</h2><p>Add a Fleet from the catalog or start with an example.</p><button className="button primary" onClick={()=>setModal('examples')}>Choose an example<Icon name="arrow"/></button></div>}
    </div>
    <div className="canvas-status"><span>{componentCount} {componentCount===1?'component':'components'}</span><span>{groups.length} {groups.length===1?'frame':'frames'}</span><span>{document.edges.length} {document.edges.length===1?'connection':'connections'}</span><span className="save-status"><i className={saveStatus==='Not saved'?'failed':''}/>{saveStatus}</span></div>
   </section>
   <aside className="inspector-panel" aria-label="Properties">
    <div className="panel-title"><h2>Properties</h2>{selected&&<button className="icon-button" aria-label="Clear selection" onClick={()=>setSelectedId(null)}><Icon name="close"/></button>}</div>
    {selected&&selectedCatalog?<div className="inspector-scroll">
     <div className="selected-card" style={{'--item-color':selectedCatalog.color} as React.CSSProperties}><span className="selected-icon">{selectedCatalog.shortLabel}</span><div><span className="eyebrow">{selectedCatalog.isBoundary?'STRUCTURE':'COMPONENT'}</span><h3>{selectedCatalog.label}</h3></div></div>
     <p className="selected-description">{selectedCatalog.description}</p>
     <div className="field"><label htmlFor="node-name">Component name</label><input id="node-name" maxLength={120} value={selected.label} onChange={e=>patch(selected,{label:e.target.value})}/></div>
     <div className="field-row"><div className="field"><label htmlFor="node-version">Version</label><input id="node-version" placeholder="e.g. 9.0" maxLength={80} value={selected.config.version} onChange={e=>patch(selected,{config:{...selected.config,version:e.target.value}})}/></div><div className="field"><label htmlFor="node-count">Instances</label><input id="node-count" type="number" min="1" max="999" value={selected.config.instances} onChange={e=>{const value=Number(e.target.value);if(Number.isInteger(value)&&value>=1&&value<=999)patch(selected,{config:{...selected.config,instances:value}})}}/></div></div>
     <div className="field"><label htmlFor="node-parent">Parent frame</label><select id="node-parent" value={selected.parentId??''} onChange={e=>assign(selected.id,e.target.value||undefined)}><option value="">Canvas (no frame)</option>{groups.filter(g=>!descendants.has(g.id)).map(g=><option key={g.id} value={g.id}>{getNodePath(document,g.id).map(node=>node.label).join(' → ')}</option>)}</select><small>Visual assignment only; it does not verify where the component actually runs.</small></div>
     <div className="field"><label htmlFor="node-notes">Notes</label><textarea id="node-notes" placeholder="Role, assumptions, workshop notes …" maxLength={2000} rows={3} value={selected.config.notes} onChange={e=>patch(selected,{config:{...selected.config,notes:e.target.value}})}/></div>
     <details className="position-details"><summary>Edit position</summary><div className="field-row"><div className="field"><label htmlFor="node-x">Position X</label><input id="node-x" type="number" value={selected.position.x} min="-100000" max="100000" onChange={e=>{const x=Number(e.target.value);if(Number.isFinite(x))commit(moveNode(document,selected.id,{...selected.position,x}))}}/></div><div className="field"><label htmlFor="node-y">Position Y</label><input id="node-y" type="number" value={selected.position.y} min="-100000" max="100000" onChange={e=>{const y=Number(e.target.value);if(Number.isFinite(y))commit(moveNode(document,selected.id,{...selected.position,y}))}}/></div></div></details>
     <div className="inspector-actions"><button className="button subtle" onClick={duplicateSelected}><Icon name="copy"/>Duplicate</button><button className="button danger subtle" aria-label="Delete component" onClick={removeSelected}><Icon name="trash"/>Delete</button></div>
     <details className="connection-section deferred-connections"><summary>Communication relationships (optional)</summary><h3>Existing relationships <span>{connections.length}</span></h3><div className="field"><label htmlFor="connection-target">Connection target</label><select id="connection-target" value={targetId} onChange={e=>setTargetId(e.target.value)}><option value="">Choose a component …</option>{document.nodes.filter(n=>n.id!==selected.id).map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></div><div className="field"><label htmlFor="connection-type">Relationship</label><select id="connection-type" value={relation} onChange={e=>setRelation(e.target.value as RelationKind)}>{Object.entries(relationLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></div><button className="button outlined full-width" disabled={!targetId} onClick={()=>connect(selected.id,targetId,relation)}><Icon name="plus"/>Add connection</button><ul className="connection-list">{connections.map(edge=><li key={edge.id}><span><small>{edge.source===selected.id?'→':'←'} {relationLabels[edge.kind]}</small>{document.nodes.find(n=>n.id===(edge.source===selected.id?edge.target:edge.source))?.label}</span><button className="icon-button" aria-label="Remove connection" onClick={()=>commit(removeEdge(document,edge.id))}><Icon name="close"/></button></li>)}</ul></details>
    </div>:<div className="inspector-empty"><div className="cursor-illustration">↖</div><h3>Every component<br/>tells a story.</h3><p>Select a component or frame to edit its properties and relationships.</p><div className="inspector-tip"><strong>Quick tip</strong><p>“Insert into” shows the target for new components. The target frame is highlighted while dragging. Use “Structure” to reach any element with the keyboard.</p></div></div>}
    <div className="hints-block"><button className="hints-toggle" onClick={()=>setShowHints(!showHints)} aria-expanded={showHints}><span>Model hints</span><span className="hint-count">{hints.length}</span><span>{showHints?'−':'+'}</span></button>{showHints&&<div className="hints-list">{hints.length?hints.map(h=><p key={h.id} className={h.severity}><span>{h.severity==='warning'?'Check':'Note'}</span>{h.message}</p>):<p>No additional hints. This does not confirm supportability.</p>}</div>}</div>
   </aside>
  </main>
  <footer className="app-footer"><span>A workshop tool for VMware Cloud Foundation · <strong>Not an official architecture validator.</strong></span><button onClick={clearLocal}>Clear local data</button><span className="version-label">v0.1 · Workshop edition</span></footer>
  <dialog ref={dialogRef} onCancel={()=>setModal(null)} className="app-dialog" aria-labelledby="dialog-title">
   <div className="dialog-header"><span className="eyebrow">VCF BRICKS</span><button className="icon-button" aria-label="Close dialog" onClick={()=>setModal(null)}><Icon name="close"/></button></div>
   {modal==='examples'?<><h2 id="dialog-title">A good starting point.</h2><p>Choose a generic workshop template and adapt it to your architecture.</p><div className="example-grid">{EXAMPLES.map((example,i)=><article className="example-card" key={example.id}><div className={`mini-architecture mini-${i}`} aria-hidden="true"><div><i/><i/><i/></div><div><i/><i/></div></div><span className="eyebrow">{i===0?'PLATFORM':'KUBERNETES'}</span><h3>{example.name}</h3><p>{example.description}</p><button className="button primary" aria-label={`Load example: ${example.name}`} onClick={()=>loadExample(example.id)}>Load example<Icon name="arrow"/></button></article>)}</div><p className="dialog-footnote">Illustrative examples — not official reference architectures or support and sizing assessments.</p></>:<><h2 id="dialog-title">Make architecture tangible, together.</h2><p>VCF Bricks brings physical component building blocks into a browser-based workshop tool.</p><ol className="help-steps"><li><strong>Define boundaries.</strong> Fleet, Instance, and Domain frames mark logical boundaries with color.</li><li><strong>Choose an insertion target.</strong> Choose a frame under “Insert into” and click a component, or drag it from the catalog onto the canvas.</li><li><strong>Place and assign.</strong> Drag components into another frame or change their parent in the properties panel. Use the structure tree to navigate.</li><li><strong>Take your draft with you.</strong> Export JSON and import it again later.</li></ol><h3>Your data stays in your browser.</h3><p>There are no accounts, telemetry, or connections to vCenter/NSX. Local storage is unencrypted and persists after you close the tab. Clear local data after using a shared device. Do not enter credentials or confidential customer information.</p><h3>Built for discussion.</h3><p>VKS stands for vSphere Kubernetes Service. Supervisors, vSphere Namespaces, and workload clusters are distinct logical components. Frames and lines do not guarantee where components actually run. Counts and versions are descriptive, not sizing guidance.</p><p className="dialog-footnote">Independent prototype; not an official product of VMware, Broadcom, or SVA. The hosting provider processes standard page requests.</p></>}
  </dialog>
  <div className="sr-only" aria-live="polite">{selected?`${selected.label} selected`:'No component selected'}{breadcrumbs.length?': '+breadcrumbs.join(' / '):''}</div>
 </div>
}
