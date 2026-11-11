import{a2 as u}from"./index-DDumLDTY.js";import{r as i,j as e}from"./vendor-react-C2MSH1Lz.js";import{B as _}from"./button-BQbxAJt_.js";import r from"./purify.es-BYftNTi7.js";import{u as C}from"./LanguageContext-Bnkz0YBd.js";import{u as E}from"./ew--QKG4CCw.js";import{C as L}from"./chevron-down-Cg0fUXUF.js";import{M as b}from"./index-C5R_a6fg.js";/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=[["path",{d:"M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z",key:"oz39mx"}]],J=u("bookmark",S);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]],K=u("chevron-left",A);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const D=[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]],I=u("chevron-up",D);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z=[["circle",{cx:"12",cy:"9",r:"1",key:"124mty"}],["circle",{cx:"19",cy:"9",r:"1",key:"1ruzo2"}],["circle",{cx:"5",cy:"9",r:"1",key:"1a8b28"}],["circle",{cx:"12",cy:"15",r:"1",key:"1e56xg"}],["circle",{cx:"19",cy:"15",r:"1",key:"1a92ep"}],["circle",{cx:"5",cy:"15",r:"1",key:"5r1jwy"}]],B=u("grip-horizontal",z);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const T=[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",key:"r04s7s"}]],Q=u("star",T);var $=r;r.sanitize.bind(r);r.isSupported;r.addHook.bind(r);r.removeHook.bind(r);r.removeHooks.bind(r);r.removeAllHooks.bind(r);r.setConfig.bind(r);r.clearConfig.bind(r);r.isValidAttribute.bind(r);r.version;r.removed;const v=240,F=160,G=1200;function Z({text:o,threshold:s=600}){const a=E(),{t:d}=C(),m=(o||"").length>s,[n,h]=i.useState(!1),[g,x]=i.useState(0),p=i.useRef(null),c=/<\/?[a-z][\s\S]*?>/i.test(o||""),y=i.useMemo(()=>c?$.sanitize(o||""):"",[o,c]),w=!c&&/(^|\n)#{1,6}\s|\*\*[^*\n]+\*\*|(^|\n)\s*[-*]\s+\S|(^|\n)\s*\d+\.\s+\S/.test(o||""),f=i.useMemo(()=>c?(o||"").replace(/<br\s*\/?>/gi,`
`).replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote)>/gi,`
`).replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\n{3,}/g,`

`).trim():"",[o,c]),k=c&&/(^|\n)#{1,6}\s|\*\*[^*\n]+\*\*/.test(f);i.useEffect(()=>{const t=N=>{if(!p.current)return;const H=N.clientY-p.current.startY,M=Math.min(G,Math.max(F,p.current.startH+H));x(M)},l=()=>{p.current=null};return window.addEventListener("mousemove",t),window.addEventListener("mouseup",l),()=>{window.removeEventListener("mousemove",t),window.removeEventListener("mouseup",l)}},[]);const j=t=>{t.preventDefault(),p.current={startY:t.clientY,startH:g||v}};return e.jsxs("div",{className:"rounded-2xl p-6 bg-card border border-border relative",children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsx("h2",{className:"text-lg font-semibold text-foreground",children:d("ev.about","About This Event")}),m&&e.jsx(_,{variant:"ghost",size:"sm",className:"h-7 text-xs",onClick:()=>{n?(h(!1),x(0)):(h(!0),x(v))},children:n?e.jsxs(e.Fragment,{children:[e.jsx(L,{className:"w-3 h-3 mr-1"})," ",a("Expand","Ampliar")]}):e.jsxs(e.Fragment,{children:[e.jsx(I,{className:"w-3 h-3 mr-1"})," ",a("Collapse","Contraer")]})})]}),(()=>{const t="text-sm leading-relaxed text-muted-foreground overflow-y-auto pr-1 prose prose-sm max-w-none prose-p:my-2 prose-strong:text-foreground prose-headings:text-foreground prose-headings:font-bold prose-h1:text-lg prose-h2:text-base prose-h3:text-[15px] prose-headings:mt-4 prose-headings:mb-1.5",l=n?{maxHeight:g,height:g}:void 0;return k?e.jsx("div",{className:t,style:l,children:e.jsx(b,{children:f})}):c?e.jsx("div",{className:t,style:l,dangerouslySetInnerHTML:{__html:y}}):w?e.jsx("div",{className:t,style:l,children:e.jsx(b,{children:o})}):e.jsx("div",{className:`${t} whitespace-pre-wrap`,style:l,children:o})})(),n&&e.jsx("div",{role:"separator","aria-label":a("Resize description","Cambiar el tamaño de la descripción"),onMouseDown:j,className:"absolute bottom-2 right-2 flex items-center justify-center w-6 h-6 rounded-md bg-secondary/70 hover:bg-secondary border border-border cursor-ns-resize",title:a("Drag to resize","Arrastre para cambiar el tamaño"),children:e.jsx(B,{className:"w-3 h-3 text-muted-foreground"})})]})}function W({score:o=0,size:s=56,strokeWidth:a=4}){const d=(s-a)/2,m=2*Math.PI*d,n=Math.max(0,Math.min(100,o)),h=n>=80?"#14B8A6":n>=50?"#F59E0B":"#EF4444";return e.jsxs("div",{className:"relative grid place-items-center",style:{width:s,height:s},children:[e.jsxs("svg",{width:s,height:s,className:"-rotate-90",children:[e.jsx("circle",{cx:s/2,cy:s/2,r:d,fill:"none",stroke:"currentColor",strokeWidth:a,className:"opacity-15"}),e.jsx("circle",{cx:s/2,cy:s/2,r:d,fill:"none",stroke:h,strokeWidth:a,strokeLinecap:"round",strokeDasharray:m,strokeDashoffset:m-n/100*m})]}),e.jsx("span",{className:"absolute font-bold",style:{fontSize:s*.3},children:Math.round(n)})]})}export{J as B,Z as C,W as O,Q as S,I as a,K as b};
