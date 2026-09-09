import{a4 as c,r,j as o,K as k,s as b}from"./index-9oltQf4i.js";import{c as l}from"./utils-DaT-yT0k.js";/**
 * @license lucide-react v1.43.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p={name:"chevron-right",size:24,node:[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]]};p.node;const D=c(p);/**
 * @license lucide-react v1.43.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g={name:"copy",size:24,node:[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]]};g.node;const z=c(g);/**
 * @license lucide-react v1.43.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m={name:"image",size:24,node:[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",ry:"2",key:"1m3agn"}],["circle",{cx:"9",cy:"9",r:"2",key:"af1f0g"}],["path",{d:"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",key:"1xmnt7"}]]};m.node;const I=c(m);/**
 * @license lucide-react v1.43.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f={name:"settings",size:24,node:[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]};f.node;const E=c(f);/**
 * @license lucide-react v1.43.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x={name:"user-plus",size:24,node:[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"19",x2:"19",y1:"8",y2:"14",key:"1bvyxn"}],["line",{x1:"22",x2:"16",y1:"11",y2:"11",key:"1shjgl"}]]};x.node;const N=c(x),d=r.createContext({open:!1,setOpen:()=>{}});function S({open:e,defaultOpen:t,onOpenChange:s,children:n}){const[a,i]=r.useState(!!t),h=e!==void 0?e:a,v=u=>{e===void 0&&i(u),s==null||s(u)};return o.jsx(d.Provider,{value:{open:h,setOpen:v},children:n})}function L({children:e,asChild:t}){const{setOpen:s}=r.useContext(d);return t&&r.isValidElement(e)?r.cloneElement(e,{onClick:n=>{var a,i;(i=(a=e.props).onClick)==null||i.call(a,n),s(!0)}}):o.jsx("button",{type:"button",onClick:()=>s(!0),children:e})}function T({className:e,children:t}){const{open:s,setOpen:n}=r.useContext(d);return s?k.createPortal(o.jsxs("div",{className:"fixed inset-0 z-[120] flex items-center justify-center p-4",role:"dialog",children:[o.jsx("div",{className:"absolute inset-0 bg-black/50",onClick:()=>n(!1)}),o.jsxs("div",{className:l("glass-modal relative z-10 w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-3xl p-5 shadow-2xl",e),children:[o.jsx("button",{onClick:()=>n(!1),"aria-label":"Close",className:"absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-lg opacity-60 hover:bg-ink/10 dark:hover:bg-white/10",children:"×"}),t]})]}),document.body):null}const U=({className:e,...t})=>o.jsx("div",{className:l("mb-3 pr-6",e),...t}),A=({className:e,...t})=>o.jsx("div",{className:l("mt-4 flex flex-wrap justify-end gap-2",e),...t}),R=({className:e,...t})=>o.jsx("h2",{className:l("text-lg font-bold",e),...t}),M=({className:e,...t})=>o.jsx("p",{className:l("text-sm opacity-65",e),...t}),y=()=>typeof window<"u"?window.location.origin:"https://app.oneworldlabs.ai";function $(e){const t=e.replace(/-/g,"").toLowerCase();if(!/^[a-f0-9]{32}$/.test(t))return e.trim();let s="";for(let n=0;n<t.length;n+=2)s+=String.fromCharCode(parseInt(t.slice(n,n+2),16));return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}function P(e){const t=e.trim();if(/^[a-f0-9-]{36}$/i.test(t)||!/^[A-Za-z0-9_-]{22}$/.test(t))return t;try{const s=t.replace(/-/g,"+").replace(/_/g,"/").padEnd(24,"="),n=atob(s),a=Array.from(n,i=>i.charCodeAt(0).toString(16).padStart(2,"0")).join("");return/^[a-f0-9]{32}$/.test(a)?`${a.slice(0,8)}-${a.slice(8,12)}-${a.slice(12,16)}-${a.slice(16,20)}-${a.slice(20)}`:t}catch{return t}}function w(e){return`${y()}/events/e/${$(e)}`}function V(e,t){return`${w(e)}?src=${t}`}function j(e){return e.trim().replace(/\s+/g,"-").replace(/[^A-Za-z0-9-]/g,"").replace(/-+/g,"-").replace(/^-|-$/g,"")}function q(e,t){const s=j(e),n=`${y()}/events/${encodeURIComponent(s)}`;return t?`${n}?src=${encodeURIComponent(t)}`:n}function H(e){b.functions.invoke("notify-new-message",{body:{recipient_id:e.recipientId,sender_id:e.senderId,message_preview:e.messagePreview,message_type:e.messageType||"text"}}).catch(()=>{})}export{z as C,S as D,I,E as S,N as U,T as a,U as b,R as c,A as d,q as e,V as f,w as g,M as h,H as i,D as j,L as k,P as l,j as n};
