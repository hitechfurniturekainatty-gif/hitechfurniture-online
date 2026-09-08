import {useEffect} from 'react';
import {preloadRoute} from '@/lib/routePreload';
/** Fetch page code on hover, keyboard focus or touch, before navigation starts. */
export function RouteIntentPreloader(){
 useEffect(()=>{
  const intent=(e:Event)=>{
   const connection=(navigator as Navigator & {connection?:{saveData?:boolean;effectiveType?:string}}).connection;
   if(connection?.saveData||connection?.effectiveType?.includes('2g'))return;
   const anchor=e.target instanceof Element?e.target.closest('a[href]'):null;
   if(!(anchor instanceof HTMLAnchorElement)||anchor.download||anchor.target==='_blank')return;
   const url=new URL(anchor.href,window.location.href);
   if(url.origin===window.location.origin&&url.pathname!==window.location.pathname)preloadRoute(url.pathname);
  };
  document.addEventListener('pointerover',intent,{passive:true});
  document.addEventListener('focusin',intent);
  document.addEventListener('touchstart',intent,{passive:true});
  return()=>{document.removeEventListener('pointerover',intent);document.removeEventListener('focusin',intent);document.removeEventListener('touchstart',intent);};
 },[]);
 return null;
}
