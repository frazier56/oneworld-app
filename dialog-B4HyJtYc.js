import{$ as o,r as n,j as a,G as m}from"./index-gkWDJFtV.js";import{c as i}from"./utils-DaT-yT0k.js";/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=[["path",{d:"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z",key:"18u6gg"}],["circle",{cx:"12",cy:"13",r:"3",key:"1vg3eu"}]],w=o("camera",p);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],C=o("chevron-right",h);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],D=o("copy",g);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",ry:"2",key:"1m3agn"}],["circle",{cx:"9",cy:"9",r:"2",key:"af1f0g"}],["path",{d:"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",key:"1xmnt7"}]],M=o("image",k);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}],["path",{d:"m15 5 4 4",key:"1mk7zo"}]],$=o("pencil",f);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]],z=o("settings",v);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],E=o("trash-2",j);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"19",x2:"19",y1:"8",y2:"14",key:"1bvyxn"}],["line",{x1:"22",x2:"16",y1:"11",y2:"11",key:"1shjgl"}]],H=o("user-plus",N),d=n.createContext({open:!1,setOpen:()=>{}});function P({open:e,defaultOpen:t,onOpenChange:s,children:c}){const[r,l]=n.useState(!!t),x=e!==void 0?e:r,u=y=>{e===void 0&&l(y),s==null||s(y)};return a.jsx(d.Provider,{value:{open:x,setOpen:u},children:c})}function V({children:e,asChild:t}){const{setOpen:s}=n.useContext(d);return t&&n.isValidElement(e)?n.cloneElement(e,{onClick:c=>{var r,l;(l=(r=e.props).onClick)==null||l.call(r,c),s(!0)}}):a.jsx("button",{type:"button",onClick:()=>s(!0),children:e})}function I({className:e,children:t}){const{open:s,setOpen:c}=n.useContext(d);return s?m.createPortal(a.jsxs("div",{className:"fixed inset-0 z-[120] flex items-center justify-center p-4",role:"dialog",children:[a.jsx("div",{className:"absolute inset-0 bg-black/50",onClick:()=>c(!1)}),a.jsxs("div",{className:i("glass-modal relative z-10 w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-3xl p-5 shadow-2xl",e),children:[a.jsx("button",{onClick:()=>c(!1),"aria-label":"Close",className:"absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-lg opacity-60 hover:bg-ink/10 dark:hover:bg-white/10",children:"×"}),t]})]}),document.body):null}const T=({className:e,...t})=>a.jsx("div",{className:i("mb-3 pr-6",e),...t}),A=({className:e,...t})=>a.jsx("div",{className:i("mt-4 flex flex-wrap justify-end gap-2",e),...t}),L=({className:e,...t})=>a.jsx("h2",{className:i("text-lg font-bold",e),...t}),S=({className:e,...t})=>a.jsx("p",{className:i("text-sm opacity-65",e),...t});export{w as C,P as D,M as I,$ as P,z as S,E as T,H as U,I as a,T as b,L as c,A as d,S as e,C as f,D as g,V as h};
