import{$ as r,r as h,j as e}from"./index-Ck6OGc9S.js";import{u as d}from"./LanguageContext-tQHR_oti.js";import{C as p}from"./check-C5yzi4Vj.js";import{S as y}from"./share-2-BDe4yy_j.js";/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=[["path",{d:"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",key:"jecpp"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]],w=r("briefcase",x);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"12",cy:"5",r:"1",key:"gxeob9"}],["circle",{cx:"12",cy:"19",r:"1",key:"lyex9k"}]],j=r("ellipsis-vertical",m);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=[["path",{d:"m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5",key:"ftymec"}],["rect",{x:"2",y:"6",width:"14",height:"12",rx:"2",key:"158x01"}]],S=r("video",f);function _({type:u,id:a,title:c,className:n=""}){const{t}=d(),[i,o]=h.useState(!1),s=`${window.location.origin}/events/e/${a}`,l=async()=>{try{navigator.share?await navigator.share({title:c||"Event",url:s}):(await navigator.clipboard.writeText(s),o(!0),setTimeout(()=>o(!1),1600))}catch{}};return e.jsxs("button",{onClick:l,className:`inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary/35 bg-primary/[0.04] px-5 py-3 text-sm font-semibold text-foreground shadow-sm shadow-primary/5 transition-colors hover:border-primary/55 hover:bg-primary/[0.08] ${n}`,children:[i?e.jsx(p,{size:16}):e.jsx(y,{size:16}),i?t("share.copied","Copied"):t("share.share","Share")]})}export{w as B,j as E,_ as S,S as V};
