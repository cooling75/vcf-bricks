import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StructureTree } from './StructureTree';
import type { ArchitectureNode } from '../contracts';
const nodes: ArchitectureNode[] = [
 {id:'fleet',kind:'fleet',label:'Fleet A',position:{x:0,y:0},config:{version:'',notes:'',instances:1}},
 {id:'vc',kind:'vcenter',label:'VC A',parentId:'fleet',position:{x:24,y:64},config:{version:'',notes:'',instances:1}},
];
describe('structure tree',()=>{
 it('reveals changed ancestors for the same selection without undoing intentional collapse',()=>{
  const second: ArchitectureNode = {...nodes[0], id:'second', label:'Fleet B'};
  const sibling: ArchitectureNode = {...nodes[1], id:'sibling', label:'Sibling', parentId:'second'};
  const initial = [...nodes, second, sibling];
  const {rerender} = render(<StructureTree nodes={initial} selectedId="vc" onSelect={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Fleet B einklappen'}));
  const reassigned = initial.map(node=>node.id==='vc'?{...node,parentId:'second'}:node);
  rerender(<StructureTree nodes={reassigned} selectedId="vc" onSelect={vi.fn()}/>);
  expect(screen.getByRole('button',{name:'VC A auswählen'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Fleet B einklappen'}));
  rerender(<StructureTree nodes={reassigned.map(node=>({...node}))} selectedId="vc" onSelect={vi.fn()}/>);
  expect(screen.queryByRole('button',{name:'VC A auswählen'})).toBeNull();
 });
 it('shows nested descendants and collapses them independently of selection',()=>{
  const select=vi.fn();
  render(<StructureTree nodes={nodes} selectedId={null} onSelect={select}/>);
  fireEvent.click(screen.getByRole('button',{name:'VC A auswählen'}));
  expect(select).toHaveBeenCalledWith('vc');
  fireEvent.click(screen.getByRole('button',{name:'Fleet A einklappen'}));
  expect(screen.queryByRole('button',{name:'VC A auswählen'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Fleet A ausklappen'}));
  expect(screen.getByRole('button',{name:'VC A auswählen'})).toBeVisible();
 });
});
