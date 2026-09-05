import{$ as n,r as i,j as s,G as g,s as m}from"./index-DbltmabY.js";import{c}from"./utils-DaT-yT0k.js";/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],w=n("chevron-right",p);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],N=n("copy",f);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",ry:"2",key:"1m3agn"}],["circle",{cx:"9",cy:"9",r:"2",key:"af1f0g"}],["path",{d:"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",key:"1xmnt7"}]],_=n("image",h);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]],D=n("settings",k);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"19",x2:"19",y1:"8",y2:"14",key:"1bvyxn"}],["line",{x1:"22",x2:"16",y1:"11",y2:"11",key:"1shjgl"}]],C=n("user-plus",v),d=i.createContext({open:!1,setOpen:()=>{}});function I({open:e,defaultOpen:t,onOpenChange:o,children:a}){const[r,l]=i.useState(!!t),y=e!==void 0?e:r,u=x=>{e===void 0&&l(x),o==null||o(x)};return s.jsx(d.Provider,{value:{open:y,setOpen:u},children:a})}function E({children:e,asChild:t}){const{setOpen:o}=i.useContext(d);return t&&i.isValidElement(e)?i.cloneElement(e,{onClick:a=>{var r,l;(l=(r=e.props).onClick)==null||l.call(r,a),o(!0)}}):s.jsx("button",{type:"button",onClick:()=>o(!0),children:e})}function $({className:e,children:t}){const{open:o,setOpen:a}=i.useContext(d);return o?g.createPortal(s.jsxs("div",{className:"fixed inset-0 z-[120] flex items-center justify-center p-4",role:"dialog",children:[s.jsx("div",{className:"absolute inset-0 bg-black/50",onClick:()=>a(!1)}),s.jsxs("div",{className:c("glass-modal relative z-10 w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-3xl p-5 shadow-2xl",e),children:[s.jsx("button",{onClick:()=>a(!1),"aria-label":"Close",className:"absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-lg opacity-60 hover:bg-ink/10 dark:hover:bg-white/10",children:"×"}),t]})]}),document.body):null}const z=({className:e,...t})=>s.jsx("div",{className:c("mb-3 pr-6",e),...t}),M=({className:e,...t})=>s.jsx("div",{className:c("mt-4 flex flex-wrap justify-end gap-2",e),...t}),P=({className:e,...t})=>s.jsx("h2",{className:c("text-lg font-bold",e),...t}),S=({className:e,...t})=>s.jsx("p",{className:c("text-sm opacity-65",e),...t});function T(e){m.functions.invoke("notify-new-message",{body:{recipient_id:e.recipientId,sender_id:e.senderId,message_preview:e.messagePreview,message_type:e.messageType||"text"}}).catch(()=>{})}export{N as C,I as D,_ as I,D as S,C as U,$ as a,z as b,P as c,M as d,S as e,w as f,E as g,T as n};
