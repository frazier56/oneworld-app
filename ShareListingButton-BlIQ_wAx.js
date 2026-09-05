import{$ as s,r as d,j as e}from"./index-Dyie02Me.js";import{u as p}from"./LanguageContext-DAagfvIt.js";import{C as m}from"./check-BuQxWDo3.js";import{S as x}from"./share-2-OKJzH10y.js";/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=[["path",{d:"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",key:"jecpp"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]],w=s("briefcase",y);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=[["path",{d:"m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5",key:"ftymec"}],["rect",{x:"2",y:"6",width:"14",height:"12",rx:"2",key:"158x01"}]],j=s("video",l);function k({type:u,id:i,title:n,className:c=""}){const{t:r}=p(),[t,a]=d.useState(!1),o=`${window.location.origin}/events/e/${i}`,h=async()=>{try{navigator.share?await navigator.share({title:n||"Event",url:o}):(await navigator.clipboard.writeText(o),a(!0),setTimeout(()=>a(!1),1600))}catch{}};return e.jsxs("button",{onClick:h,className:`inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary/35 bg-primary/[0.04] px-5 py-3 text-sm font-semibold text-foreground shadow-sm shadow-primary/5 transition-colors hover:border-primary/55 hover:bg-primary/[0.08] ${c}`,children:[t?e.jsx(m,{size:16}):e.jsx(x,{size:16}),t?r("share.copied","Copied"):r("share.share","Share")]})}export{w as B,k as S,j as V};
