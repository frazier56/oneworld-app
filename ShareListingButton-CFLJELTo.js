import{$ as a,r as p,j as e}from"./index-rUGMhhTp.js";import{u as h}from"./LanguageContext-DPp7kIXr.js";import{C as d}from"./check-XHRAQ0EG.js";import{S as m}from"./share-2-BdPzA9Zn.js";/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=[["path",{d:"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",key:"jecpp"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]],k=a("briefcase",x);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"12",cy:"5",r:"1",key:"gxeob9"}],["circle",{cx:"12",cy:"19",r:"1",key:"lyex9k"}]],w=a("ellipsis-vertical",y);function j({type:u,id:o,title:c,className:n=""}){const{t:r}=h(),[t,s]=p.useState(!1),i=`${window.location.origin}/events/e/${o}`,l=async()=>{try{navigator.share?await navigator.share({title:c||"Event",url:i}):(await navigator.clipboard.writeText(i),s(!0),setTimeout(()=>s(!1),1600))}catch{}};return e.jsxs("button",{onClick:l,className:`inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary/35 bg-primary/[0.04] px-5 py-3 text-sm font-semibold text-foreground shadow-sm shadow-primary/5 transition-colors hover:border-primary/55 hover:bg-primary/[0.08] ${n}`,children:[t?e.jsx(d,{size:16}):e.jsx(m,{size:16}),t?r("share.copied","Copied"):r("share.share","Share")]})}export{k as B,w as E,j as S};
