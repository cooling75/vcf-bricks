import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { ArchitectureDocument } from './contracts';
import type { ArchitectureCanvasProps } from './contracts';

vi.mock('./editor/ArchitectureCanvas', () => ({ ArchitectureCanvas: (props: ArchitectureCanvasProps) => <div>
  <button onClick={() => props.onSelect('leaf')}>Select leaf</button>
  <button onClick={() => props.onRelocate?.('leaf', { x: 100001, y: 0 })}>Reject move</button>
  <button onClick={() => props.onRelocate?.('leaf', { x: 900, y: 0 })}>Same move</button>
  <button onClick={() => props.onRelocate?.('nested', { x: 48, y: 128 }, 'inner-a')}>Same nested move</button>
</div> }));

beforeEach(() => {
  cleanup();
  localStorage.clear();
  const config = {version:'',instances:1,notes:''};
  const doc: ArchitectureDocument = {schemaVersion:1,id:'fixture',title:'Fixture',profile:'unspecified',mode:'sandbox',edges:[],nodes:[
    {id:'a',kind:'fleet',label:'Fleet A',position:{x:0,y:0},config},
    {id:'b',kind:'fleet',label:'Fleet B',position:{x:1000,y:0},config},
    {id:'inner-a',kind:'instance',label:'Same',parentId:'a',position:{x:24,y:64},config},
    {id:'inner-b',kind:'instance',label:'Same',parentId:'b',position:{x:24,y:64},config},
    {id:'nested',kind:'network',label:'Nested',parentId:'inner-a',position:{x:24,y:64},config},
    {id:'leaf',kind:'network',label:'Leaf',position:{x:900,y:0},size:{width:10000,height:10000},config},
  ]};
  localStorage.setItem('vcf-bricks.project.v1',JSON.stringify(doc));
});

describe('assignment controls', () => {
  it('reports rejected assignment and relocation but stays quiet for unchanged operations', () => {
    render(<App/>);
    fireEvent.click(screen.getByText('Select leaf'));
    const select = screen.getByRole('combobox',{name:'Parent frame'});
    fireEvent.change(select,{target:{value:''}});
    fireEvent.click(screen.getByText('Same move'));
    fireEvent.click(screen.getByText('Same nested move'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.change(select,{target:{value:'a'}});
    expect(screen.getByRole('alert')).toHaveTextContent(/Cannot assign/);
    expect(select).toHaveValue('');
    fireEvent.click(screen.getByRole('button',{name:'Dismiss message'}));
    fireEvent.click(screen.getByText('Reject move'));
    expect(screen.getByRole('alert')).toHaveTextContent(/Cannot move/);
  });
  it('disambiguates duplicate boundary labels with full paths', () => {
    render(<App/>);
    fireEvent.click(screen.getByText('Select leaf'));
    const select = screen.getByRole('combobox',{name:'Parent frame'});
    expect([...select.querySelectorAll('option')].map(option=>option.textContent)).toContain('Fleet A → Same');
    expect([...select.querySelectorAll('option')].map(option=>option.textContent)).toContain('Fleet B → Same');
  });
});

describe('English application UI', () => {
 it('uses English controls without translating saved document content', () => {
  const saved = JSON.parse(localStorage.getItem('vcf-bricks.project.v1')!);
  saved.title = 'Mein Entwurf';
  saved.nodes.find((node: {id:string}) => node.id === 'leaf').label = 'Mein Netzwerk';
  saved.nodes.find((node: {id:string}) => node.id === 'leaf').config = {version:'meine Version',instances:1,notes:'Meine Notizen'};
  localStorage.setItem('vcf-bricks.project.v1', JSON.stringify(saved));
  render(<App/>);
  expect(screen.getByRole('textbox', {name:'Project name'})).toHaveValue('Mein Entwurf');
  expect(screen.getByRole('complementary', {name:'Component catalog'})).toBeInTheDocument();
  expect(screen.getByRole('button', {name:'New draft'})).toBeInTheDocument();
  expect(screen.getByRole('button', {name:'Import JSON'})).toBeInTheDocument();
  expect(screen.getByRole('button', {name:'Export JSON'})).toBeInTheDocument();
  expect(screen.getByRole('combobox', {name:'Insert into'})).toHaveDisplayValue('Canvas (no frame)');
  fireEvent.click(screen.getByText('Select leaf'));
  expect(screen.getByRole('textbox', {name:'Component name'})).toHaveValue('Mein Netzwerk');
  expect(screen.getByRole('textbox', {name:'Notes'})).toHaveValue('Meine Notizen');
  expect(screen.getByRole('textbox', {name:'Version'})).toHaveValue('meine Version');
  expect(screen.getByRole('button', {name:'Delete component'})).toBeInTheDocument();
  expect(screen.getByText('Communication relationships (optional)')).toBeInTheDocument();
 });
});
