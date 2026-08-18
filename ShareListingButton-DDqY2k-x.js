import{$ as h,r as p,j as e}from"./index-DCCkbroF.js";import{u}from"./LanguageContext-CQZOnyNr.js";import{C as l}from"./check-KbX_nZ5c.js";import{S as m}from"./share-2-DXg468Kb.js";/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=[["path",{d:"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",key:"jecpp"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]],w=h("briefcase",d);function y({type:f,id:o,title:i,className:n=""}){const{t}=u(),[a,s]=p.useState(!1),r=`${window.location.origin}/events/e/${o}`,c=async()=>{try{navigator.share?await navigator.share({title:i||"Event",url:r}):(await navigator.clipboard.writeText(r),s(!0),setTimeout(()=>s(!1),1600))}catch{}};return e.jsxs("button",{onClick:c,className:`btn-ghost ${n}`,children:[a?e.jsx(l,{size:16}):e.jsx(m,{size:16}),a?t("share.copied","Copied"):t("share.share","Share")]})}export{w as B,y as S};
