import{x as c,r as i,j as a,z as f}from"./index-CiM_rSLC.js";import{c as l}from"./utils-DaT-yT0k.js";/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],N=c("chevron-right",y);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],_=c("copy",m);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",ry:"2",key:"1m3agn"}],["circle",{cx:"9",cy:"9",r:"2",key:"af1f0g"}],["path",{d:"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",key:"1xmnt7"}]],D=c("image",h);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]],E=c("settings",k);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"19",x2:"19",y1:"8",y2:"14",key:"1bvyxn"}],["line",{x1:"22",x2:"16",y1:"11",y2:"11",key:"1shjgl"}]],I=c("user-plus",v),d=i.createContext({open:!1,setOpen:()=>{}});function z({open:e,defaultOpen:t,onOpenChange:n,children:s}){const[o,r]=i.useState(!!t),x=e!==void 0?e:o,g=u=>{e===void 0&&r(u),n==null||n(u)};return a.jsx(d.Provider,{value:{open:x,setOpen:g},children:s})}function S({children:e,asChild:t}){const{setOpen:n}=i.useContext(d);return t&&i.isValidElement(e)?i.cloneElement(e,{onClick:s=>{var o,r;(r=(o=e.props).onClick)==null||r.call(o,s),n(!0)}}):a.jsx("button",{type:"button",onClick:()=>n(!0),children:e})}function L({className:e,children:t,closeLabel:n="Close"}){const{open:s,setOpen:o}=i.useContext(d);return s?f.createPortal(a.jsxs("div",{className:"fixed inset-0 z-[120] flex items-center justify-center p-4",role:"dialog",children:[a.jsx("div",{className:"absolute inset-0 bg-black/50",onClick:()=>o(!1)}),a.jsxs("div",{className:l("glass-modal relative z-10 w-full max-w-lg max-h-[88svh] overflow-y-auto rounded-3xl p-5 shadow-2xl",e),children:[a.jsx("button",{onClick:()=>o(!1),"aria-label":n,className:"absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-lg opacity-60 hover:bg-ink/10 dark:hover:bg-white/10",children:"×"}),t]})]}),document.body):null}const U=({className:e,...t})=>a.jsx("div",{className:l("mb-3 pr-6",e),...t}),A=({className:e,...t})=>a.jsx("div",{className:l("mt-4 flex flex-wrap justify-end gap-2",e),...t}),R=({className:e,...t})=>a.jsx("h2",{className:l("text-lg font-bold",e),...t}),T=({className:e,...t})=>a.jsx("p",{className:l("text-sm opacity-65",e),...t}),p=()=>typeof window<"u"?window.location.origin:"https://app.oneworldlabs.ai";function b(e){const t=e.replace(/-/g,"").toLowerCase();if(!/^[a-f0-9]{32}$/.test(t))return e.trim();let n="";for(let s=0;s<t.length;s+=2)n+=String.fromCharCode(parseInt(t.slice(s,s+2),16));return btoa(n).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}function M(e){const t=e.trim();if(/^[a-f0-9-]{36}$/i.test(t)||!/^[A-Za-z0-9_-]{22}$/.test(t))return t;try{const n=t.replace(/-/g,"+").replace(/_/g,"/").padEnd(24,"="),s=atob(n),o=Array.from(s,r=>r.charCodeAt(0).toString(16).padStart(2,"0")).join("");return/^[a-f0-9]{32}$/.test(o)?`${o.slice(0,8)}-${o.slice(8,12)}-${o.slice(12,16)}-${o.slice(16,20)}-${o.slice(20)}`:t}catch{return t}}function $(e){return`${p()}/events/e/${b(e)}`}function P(e,t){return`${$(e)}?src=${t}`}function j(e){return e.trim().replace(/\s+/g,"-").replace(/[^A-Za-z0-9-]/g,"").replace(/-+/g,"-").replace(/^-|-$/g,"")}function V(e,t){const n=j(e),s=`${p()}/events/${encodeURIComponent(n)}`;return t?`${s}?src=${encodeURIComponent(t)}`:s}export{_ as C,z as D,D as I,E as S,I as U,L as a,U as b,R as c,A as d,V as e,P as f,$ as g,T as h,N as i,S as j,M as k,j as n};
