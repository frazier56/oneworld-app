import{G as h,r as i,j as e}from"./index-CbhCbJL6.js";import{B as M}from"./button-C4JDFihj.js";import s from"./purify.es-DP5U8-sc.js";import{u as _}from"./LanguageContext-4TMiMYAK.js";import{C as E}from"./chevron-down-h3Fuc_Vm.js";import{M as f}from"./index-DtT8VJTq.js";/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=[["path",{d:"M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z",key:"oz39mx"}]],P=h("bookmark",C);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L=[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]],U=h("chevron-left",L);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]],D=h("chevron-up",S);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=[["circle",{cx:"12",cy:"9",r:"1",key:"124mty"}],["circle",{cx:"19",cy:"9",r:"1",key:"1ruzo2"}],["circle",{cx:"5",cy:"9",r:"1",key:"1a8b28"}],["circle",{cx:"12",cy:"15",r:"1",key:"1e56xg"}],["circle",{cx:"19",cy:"15",r:"1",key:"1a92ep"}],["circle",{cx:"5",cy:"15",r:"1",key:"5r1jwy"}]],I=h("grip-horizontal",A);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z=[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",key:"r04s7s"}]],V=h("star",z);var B=s;s.sanitize.bind(s);s.isSupported;s.addHook.bind(s);s.removeHook.bind(s);s.removeHooks.bind(s);s.removeAllHooks.bind(s);s.setConfig.bind(s);s.clearConfig.bind(s);s.isValidAttribute.bind(s);s.version;s.removed;const b=240,T=160,G=1200;function X({text:o,threshold:r=600}){const{t:d}=_(),m=(o||"").length>r,[n,a]=i.useState(!1),[p,g]=i.useState(0),u=i.useRef(null),c=/<\/?[a-z][\s\S]*?>/i.test(o||""),v=i.useMemo(()=>c?B.sanitize(o||""):"",[o,c]),y=!c&&/(^|\n)#{1,6}\s|\*\*[^*\n]+\*\*|(^|\n)\s*[-*]\s+\S|(^|\n)\s*\d+\.\s+\S/.test(o||""),x=i.useMemo(()=>c?(o||"").replace(/<br\s*\/?>/gi,`
`).replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote)>/gi,`
`).replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\n{3,}/g,`

`).trim():"",[o,c]),k=c&&/(^|\n)#{1,6}\s|\*\*[^*\n]+\*\*/.test(x);i.useEffect(()=>{const t=j=>{if(!u.current)return;const N=j.clientY-u.current.startY,H=Math.min(G,Math.max(T,u.current.startH+N));g(H)},l=()=>{u.current=null};return window.addEventListener("mousemove",t),window.addEventListener("mouseup",l),()=>{window.removeEventListener("mousemove",t),window.removeEventListener("mouseup",l)}},[]);const w=t=>{t.preventDefault(),u.current={startY:t.clientY,startH:p||b}};return e.jsxs("div",{className:"rounded-2xl p-6 bg-card border border-border relative",children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsx("h2",{className:"text-lg font-semibold text-foreground",children:d("ev.about","About This Event")}),m&&e.jsx(M,{variant:"ghost",size:"sm",className:"h-7 text-xs",onClick:()=>{n?(a(!1),g(0)):(a(!0),g(b))},children:n?e.jsxs(e.Fragment,{children:[e.jsx(E,{className:"w-3 h-3 mr-1"})," Expand"]}):e.jsxs(e.Fragment,{children:[e.jsx(D,{className:"w-3 h-3 mr-1"})," Collapse"]})})]}),(()=>{const t="text-sm leading-relaxed text-muted-foreground overflow-y-auto pr-1 prose prose-sm max-w-none prose-p:my-2 prose-strong:text-foreground prose-headings:text-foreground prose-headings:font-bold prose-h1:text-lg prose-h2:text-base prose-h3:text-[15px] prose-headings:mt-4 prose-headings:mb-1.5",l=n?{maxHeight:p,height:p}:void 0;return k?e.jsx("div",{className:t,style:l,children:e.jsx(f,{children:x})}):c?e.jsx("div",{className:t,style:l,dangerouslySetInnerHTML:{__html:v}}):y?e.jsx("div",{className:t,style:l,children:e.jsx(f,{children:o})}):e.jsx("div",{className:`${t} whitespace-pre-wrap`,style:l,children:o})})(),n&&e.jsx("div",{role:"separator","aria-label":"Resize description",onMouseDown:w,className:"absolute bottom-2 right-2 flex items-center justify-center w-6 h-6 rounded-md bg-secondary/70 hover:bg-secondary border border-border cursor-ns-resize",title:"Drag to resize",children:e.jsx(I,{className:"w-3 h-3 text-muted-foreground"})})]})}function J({score:o=0,size:r=56,strokeWidth:d=4}){const m=(r-d)/2,n=2*Math.PI*m,a=Math.max(0,Math.min(100,o)),p=a>=80?"#14B8A6":a>=50?"#F59E0B":"#EF4444";return e.jsxs("div",{className:"relative grid place-items-center",style:{width:r,height:r},children:[e.jsxs("svg",{width:r,height:r,className:"-rotate-90",children:[e.jsx("circle",{cx:r/2,cy:r/2,r:m,fill:"none",stroke:"currentColor",strokeWidth:d,className:"opacity-15"}),e.jsx("circle",{cx:r/2,cy:r/2,r:m,fill:"none",stroke:p,strokeWidth:d,strokeLinecap:"round",strokeDasharray:n,strokeDashoffset:n-a/100*n})]}),e.jsx("span",{className:"absolute font-bold",style:{fontSize:r*.3},children:Math.round(a)})]})}export{P as B,X as C,J as O,V as S,D as a,U as b};
