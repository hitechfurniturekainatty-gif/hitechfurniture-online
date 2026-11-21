import {it,expect,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import type {ReactNode} from 'react';


vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({
  isAdmin:true,isOfficeStaff:true,isWarehouse:false,isDelivery:false,
  isMeasurementStaff:false,user:{id:'a'},loading:false
})}));
vi.mock('@/components/admin/AdminShell',()=>({AdminShell:({children}:{children:ReactNode})=>children}));


import AdminOverview from './AdminOverview';


it('renders the home dashboard: greeting, quick add, KPI tiles, work list and pipeline',()=>{
  render(<MemoryRouter><AdminOverview/></MemoryRouter>);
  expect(screen.getByRole('heading',{level:1,name:/^Good (morning|afternoon|evening)/})).toBeInTheDocument();
  for (const label of ['Enquiry','Quotation','Task','Complaint']) {
    expect(screen.getByRole('link',{name:label})).toBeInTheDocument();
  }
  expect(screen.getByRole('link',{name:/Open enquiries/})).toHaveAttribute('href','/admin/leads');
  expect(screen.getByRole('link',{name:/Payments pending/})).toHaveAttribute('href','/admin/backlog');
  expect(screen.getByRole('link',{name:/Deliveries · 7 days/})).toHaveAttribute('href','/admin/delivery');
  expect(screen.getByRole('heading',{name:'My work'})).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'Order pipeline'})).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'Biggest quotations to close'})).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'Recently added'})).toBeInTheDocument();
});
