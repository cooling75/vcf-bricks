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
    const select = screen.getByRole('combobox',{name:'Zugehöriger Rahmen'});
    fireEvent.change(select,{target:{value:''}});
    fireEvent.click(screen.getByText('Same move'));
    fireEvent.click(screen.getByText('Same nested move'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.change(select,{target:{value:'a'}});
    expect(screen.getByRole('alert')).toHaveTextContent(/Zuordnung.*nicht/);
    expect(select).toHaveValue('');
    fireEvent.click(screen.getByRole('button',{name:'Meldung schließen'}));
    fireEvent.click(screen.getByText('Reject move'));
    expect(screen.getByRole('alert')).toHaveTextContent(/Verschieben.*nicht/);
  });
  it('disambiguates duplicate boundary labels with full paths', () => {
    render(<App/>);
    fireEvent.click(screen.getByText('Select leaf'));
    const select = screen.getByRole('combobox',{name:'Zugehöriger Rahmen'});
    expect([...select.querySelectorAll('option')].map(option=>option.textContent)).toContain('Fleet A → Same');
    expect([...select.querySelectorAll('option')].map(option=>option.textContent)).toContain('Fleet B → Same');
  });
});
