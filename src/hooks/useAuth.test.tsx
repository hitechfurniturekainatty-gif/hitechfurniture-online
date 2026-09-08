import {describe,it,expect,vi,beforeEach} from 'vitest';
import {render,screen,waitFor,act} from '@testing-library/react';
const mock=vi.hoisted(()=>({listener:null as any,eq:vi.fn(),getSession:vi.fn(),unsubscribe:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({select:()=>({eq:mock.eq})}),auth:{
 getSession:mock.getSession,onAuthStateChange:(cb:any)=>{mock.listener=cb;return {data:{subscription:{unsubscribe:mock.unsubscribe}}};},signOut:vi.fn()
}}}));
import {AuthProvider,useAuth} from './useAuth';
const session=(id:string)=>({user:{id}});
function Consumer({name}:{name:string}){const a=useAuth();return <div data-testid={name}>{a.loading?'loading':a.user?.id+':'+a.roles.join(',')}</div>;}
beforeEach(()=>{mock.eq.mockReset();mock.getSession.mockReset();mock.unsubscribe.mockClear();mock.getSession.mockResolvedValue({data:{session:session('a')}});mock.eq.mockResolvedValue({data:[{role:'admin'}],error:null});});
describe('shared authentication',()=>{
 it('deduplicates initial session events and shares roles across mounted and new consumers',async()=>{
  const view=render(<AuthProvider><Consumer name="one"/><Consumer name="two"/></AuthProvider>);
  act(()=>mock.listener('INITIAL_SESSION',session('a')));
  await waitFor(()=>expect(screen.getByTestId('one')).toHaveTextContent('a:admin'));
  expect(mock.eq).toHaveBeenCalledTimes(1);
  view.rerender(<AuthProvider><Consumer name="three"/></AuthProvider>);
  expect(screen.getByTestId('three')).toHaveTextContent('a:admin');
  expect(mock.eq).toHaveBeenCalledTimes(1);
 });
 it('does not restore roles from an old request after sign-out',async()=>{
  let resolve:any;mock.eq.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  render(<AuthProvider><Consumer name="one"/></AuthProvider>);
  await waitFor(()=>expect(mock.eq).toHaveBeenCalledTimes(1));
  act(()=>mock.listener('SIGNED_OUT',null));
  await act(async()=>resolve({data:[{role:'admin'}],error:null}));
  expect(screen.getByTestId('one')).toHaveTextContent('undefined:');
 });
 it('rejects a late response for another account and refreshes roles on token renewal',async()=>{
  let old:any;mock.eq.mockImplementationOnce(()=>new Promise(r=>{old=r;})).mockResolvedValue({data:[{role:'warehouse'}],error:null});
  render(<AuthProvider><Consumer name="one"/></AuthProvider>);
  await waitFor(()=>expect(mock.eq).toHaveBeenCalledTimes(1));
  act(()=>mock.listener('SIGNED_IN',session('b')));
  await waitFor(()=>expect(screen.getByTestId('one')).toHaveTextContent('b:warehouse'));
  await act(async()=>old({data:[{role:'admin'}],error:null}));
  expect(screen.getByTestId('one')).toHaveTextContent('b:warehouse');
  mock.eq.mockResolvedValue({data:[],error:null});
  act(()=>mock.listener('TOKEN_REFRESHED',session('b')));
  await waitFor(()=>expect(screen.getByTestId('one').textContent).toBe('b:'));
 });
 it('fails closed when roles cannot be loaded',async()=>{
  mock.eq.mockResolvedValue({data:null,error:{message:'offline'}});
  render(<AuthProvider><Consumer name="one"/></AuthProvider>);
  await waitFor(()=>expect(screen.getByTestId('one').textContent).toBe('a:'));
 });
});
