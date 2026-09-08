import {useState} from 'react';
import {it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {InvoiceCard} from './InvoiceCard';
import type {Invoice} from './types';
it('saves changed MRP once and skips untouched focus/blur',()=>{
 const persist=vi.fn();
 function Fixture(){
  const [invoice,setInvoice]=useState<Invoice>({id:'i',label:'Bill',rows:[{id:'r',item:'Mattress',qty:1,price:75,amountWithTax:75,mrp:100}]});
  return <InvoiceCard index={0} invoice={invoice} savedSchemes={[]} fallbackScheme={{kind:'bogo',config:{rules:[]}}} onChange={p=>setInvoice(i=>({...i,...p}))} onPersist={persist} onRemove={()=>{}} onEdit={()=>{}}/>;
 }
 render(<Fixture/>);
 const field=screen.getByLabelText('MRP for Mattress');
 fireEvent.focus(field);fireEvent.blur(field);
 expect(persist).not.toHaveBeenCalled();
 fireEvent.focus(field);fireEvent.change(field,{target:{value:'120'}});fireEvent.blur(field);
 expect(persist).toHaveBeenCalledTimes(1);
});
