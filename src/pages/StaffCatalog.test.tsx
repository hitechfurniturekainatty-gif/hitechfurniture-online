import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
const mocks=vi.hoisted(()=>({auth:{user:{id:"staff"} as {id:string}|null,loading:false,isOfficeStaff:true,isAdmin:false,isWarehouse:false,isDelivery:false,isMeasurementStaff:false},select:vi.fn()}));
vi.mock("@/hooks/useAuth",()=>({useAuth:()=>mocks.auth}));
vi.mock("@/components/admin/AdminShell",()=>({AdminShell:({children}:any)=>children}));
vi.mock("@/components/admin/FloorReorderDialog",()=>({FloorReorderDialog:()=>null}));
const data:Record<string,unknown[]>={
  products:[{id:"p",product_name:"Sofa",product_code:"S1",mrp:25000,stock_quantity:2,stock_status:"in_stock",location_id:"a",floor_display_order:10,product_images:[],product_variants:[]}],
  product_bundles:[],
  product_locations:[{id:"a",building:"Main Shop",floor:"1st Floor",section:"Part A",part:"Part A"}],
  main_categories:[],
};
vi.mock("@/integrations/supabase/client",()=>({supabase:{from:(table:string)=>{
  const query:any={select:(fields:string)=>{mocks.select(fields);return query;},is:()=>query,eq:()=>query,order:()=>query,range:()=>Promise.resolve({data:data[table]||[],error:null})};return query;
}}}));
import StaffCatalog from "./StaffCatalog";
beforeEach(()=>{mocks.auth.user={id:"staff"};mocks.auth.isOfficeStaff=true;mocks.auth.isAdmin=false;mocks.select.mockClear();});
afterEach(cleanup);
function show(){return render(<MemoryRouter initialEntries={["/admin/staff-catalog"]}><Routes><Route path="/admin/staff-catalog" element={<StaffCatalog/>}/><Route path="/auth" element={<p>Sign in required</p>}/></Routes></MemoryRouter>);}
it("requires login even when a former PIN unlock remains in sessionStorage",async()=>{
  sessionStorage.setItem("staff_catalog_unlocked","1");mocks.auth.user=null;
  show();expect(await screen.findByText("Sign in required")).toBeInTheDocument();expect(mocks.select).not.toHaveBeenCalled();sessionStorage.clear();
});
it("opens directly for staff, shows MRP and never asks for a second PIN or supplier price",async()=>{
  show();
  expect(await screen.findByRole("button",{name:"Open Sofa"})).toBeInTheDocument();
  expect(screen.queryByPlaceholderText("Catalog PIN")).not.toBeInTheDocument();
  expect(screen.queryByRole("button",{name:"Arrange Display"})).not.toBeInTheDocument();
  expect(mocks.select.mock.calls.every(([fields])=>!fields.includes("cost_price"))).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"Open Sofa"}));
  expect(await screen.findByRole("button",{name:"Next"})).toBeDisabled();
  expect(screen.getByRole("button",{name:"Previous"})).toBeDisabled();
  expect(screen.queryByRole("button",{name:"Stock In / Out"})).not.toBeInTheDocument();
});
it("shows admin arrangement controls and waits for a section selection",async()=>{
  mocks.auth.isAdmin=true;show();
  await waitFor(()=>expect(screen.getByRole("button",{name:"Arrange Display"})).toBeDisabled());
  expect(await screen.findByRole("button",{name:"Open Sofa"})).toBeInTheDocument();
});
