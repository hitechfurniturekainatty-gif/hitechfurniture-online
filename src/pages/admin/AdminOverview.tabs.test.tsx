import {it,expect,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';


vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({
  isAdmin:true,isOfficeStaff:true,isWarehouse:false,isDelivery:false,
  isMeasurementStaff:false,user:{id:'a'},loading:false
})}));
vi.mock('@/components/admin/AdminShell',()=>({AdminShell:({children}:any)=>children}));


import AdminOverview from './AdminOverview';


it('renders the simplified operational home dashboard',()=>{
  render(<MemoryRouter><AdminOverview/></MemoryRouter>);
  expect(screen.getByRole('heading',{name:'Home Dashboard'})).toBeInTheDocument();
  expect(screen.getByText('Today Enquiries')).toBeInTheDocument();
  expect(screen.getByText('Orders')).toBeInTheDocument();
  expect(screen.getByText('Deliveries')).toBeInTheDocument();
  expect(screen.getByText('Pending Payments')).toBeInTheDocument();
});
