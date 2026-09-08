import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "staff" | "measurement_staff" | "delivery" | "worker" | "warehouse";

type AuthState = {user: User | null; roles: AppRole[]; loading: boolean};
const AuthContext = createContext<AuthState>({user:null,roles:[],loading:true});

/** One session listener and one role request shared by the whole app. */
export function AuthProvider({children}:{children:ReactNode}) {
  const [state,setState]=useState<AuthState>({user:null,roles:[],loading:true});
  useEffect(()=>{
    let disposed=false, revision=0, authEvents=0;
    let currentId:string|null=null;
    let currentUser:User|null=null;
    let pending:string|null=null;
    let loaded:string|null=null;
    const accept=(user:User|null,refresh=false)=>{
      if(disposed)return;
      const id=user?.id||null;
      currentUser=user;
      if(id!==currentId){
        if(currentId){try{sessionStorage.removeItem("backlog_unlock_until");}catch{}}
        currentId=id;revision++;pending=null;loaded=null;
        setState({user,roles:[],loading:!!id});
      }else setState(s=>({...s,user}));
      if(!id){
        setState({user:null,roles:[],loading:false});
        try{sessionStorage.removeItem("backlog_unlock_until");}catch{}
        return;
      }
      if(pending===id || (loaded===id&&!refresh))return;
      pending=id;
      const ticket=revision;
      // Never await a Supabase call inside its auth event callback.
      setTimeout(async()=>{
        if(disposed||ticket!==revision)return;
        try{
          const {data,error}=await supabase.from("user_roles").select("role").eq("user_id",id);
          if(disposed||ticket!==revision)return;
          pending=null;loaded=error?null:id;
          setState(s=>({...s,roles:error?[]:(data||[]).map(r=>r.role as AppRole),loading:false}));
        }catch{
          if(!disposed&&ticket===revision){pending=null;loaded=null;setState(s=>({...s,roles:[],loading:false}));}
        }
      },0);
    };
    const {data:sub}=supabase.auth.onAuthStateChange((event,session)=>{
      authEvents++;
      accept(session?.user||null,event==="TOKEN_REFRESHED"||event==="USER_UPDATED");
    });
    const initialEvents=authEvents;
    supabase.auth.getSession().then(({data:{session}})=>{
      if(authEvents===initialEvents)accept(session?.user||null);
    }).catch(()=>{if(!disposed&&authEvents===initialEvents)accept(null);});
    // Revalidate grants centrally without putting every page back into loading.
    const refresh=window.setInterval(()=>{if(currentUser&&!document.hidden)accept(currentUser,true);},60_000);
    return ()=>{disposed=true;revision++;window.clearInterval(refresh);sub.subscription.unsubscribe();};
  },[]);
  return createElement(AuthContext.Provider,{value:state},children);
}

export function useAuth() {
  const {user,roles,loading}=useContext(AuthContext);
  const isAdmin = roles.includes("admin");
  const isMeasurementStaff = roles.includes("measurement_staff");
  const isOfficeStaff = roles.includes("staff") || isAdmin;
  const isDelivery = roles.includes("delivery");
  const isWorker = roles.includes("worker");
  const isWarehouse = roles.includes("warehouse");
  // any authenticated app user (admin/staff/measurement_staff)
  const isStaff = isOfficeStaff || isMeasurementStaff || isDelivery || isWorker || isWarehouse;

  // Canonical landing route per role — used by AdminOverview to redirect
  // staff who shouldn't see the full pipeline grid.
  const roleHome: string =
    isAdmin ? "/admin"
      : isOfficeStaff ? "/admin"
        : isWorker && !isOfficeStaff && !isAdmin ? "/worker"
          : isWarehouse ? "/admin/warehouse"
            : isMeasurementStaff ? "/admin/my-work"
              : isDelivery ? "/admin/my-trips"
                : "/admin";

  return {
    user,
    roles,
    loading,
    isAdmin,
    isOfficeStaff,
    isMeasurementStaff,
    isDelivery,
    isWorker,
    isWarehouse,
    isStaff,
    roleHome,
    signOut: () => supabase.auth.signOut(),
  };
}
