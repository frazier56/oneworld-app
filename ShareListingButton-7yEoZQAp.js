import{$ as c,r as h,j as e}from"./index-uwY0uUHN.js";import{C as p}from"./check-miOKBkKk.js";import{S as l}from"./share-2-D76NSQeq.js";/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=[["path",{d:"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",key:"jecpp"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]],g=c("briefcase",u);function j({type:x,id:r,title:o,className:i=""}){const[t,a]=h.useState(!1),s=`${window.location.origin}/events/e/${r}`,n=async()=>{try{navigator.share?await navigator.share({title:o||"Event",url:s}):(await navigator.clipboard.writeText(s),a(!0),setTimeout(()=>a(!1),1600))}catch{}};return e.jsxs("button",{onClick:n,className:`btn-ghost ${i}`,children:[t?e.jsx(p,{size:16}):e.jsx(l,{size:16}),t?"Copied":"Share"]})}export{g as B,j as S};
