import{an as u,bU as _,a as i,j as e}from"./index-JNUL6VwC.js";import{B as C}from"./button-DQzcXegt.js";import s from"./purify.es-BYftNTi7.js";import{u as E}from"./LanguageContext-Ci1LHmWq.js";import{C as L}from"./chevron-down-BCo1gu-o.js";import{M as b}from"./index-ISRpKYfM.js";/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=[["path",{d:"M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z",key:"oz39mx"}]],V=u("bookmark",S);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]],X=u("chevron-left",A);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const D=[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]],I=u("chevron-up",D);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const T=[["circle",{cx:"12",cy:"9",r:"1",key:"124mty"}],["circle",{cx:"19",cy:"9",r:"1",key:"1ruzo2"}],["circle",{cx:"5",cy:"9",r:"1",key:"1a8b28"}],["circle",{cx:"12",cy:"15",r:"1",key:"1e56xg"}],["circle",{cx:"19",cy:"15",r:"1",key:"1a92ep"}],["circle",{cx:"5",cy:"15",r:"1",key:"5r1jwy"}]],z=u("grip-horizontal",T);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const B=[["path",{d:"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",key:"r04s7s"}]],J=u("star",B);var $=s;s.sanitize.bind(s);s.isSupported;s.addHook.bind(s);s.removeHook.bind(s);s.removeHooks.bind(s);s.removeAllHooks.bind(s);s.setConfig.bind(s);s.clearConfig.bind(s);s.isValidAttribute.bind(s);s.version;s.removed;const v=240,F=160,G=1200;function K({text:o,threshold:r=600}){const{t:d}=E(),m=(o||"").length>r,a=_(),[n,h]=i.useState(!1),[g,x]=i.useState(0),p=i.useRef(null),c=/<\/?[a-z][\s\S]*?>/i.test(o||""),y=i.useMemo(()=>c?$.sanitize(o||""):"",[o,c]),w=!c&&/(^|\n)#{1,6}\s|\*\*[^*\n]+\*\*|(^|\n)\s*[-*]\s+\S|(^|\n)\s*\d+\.\s+\S/.test(o||""),f=i.useMemo(()=>c?(o||"").replace(/<br\s*\/?>/gi,`
`).replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote)>/gi,`
`).replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\n{3,}/g,`

`).trim():"",[o,c]),k=c&&/(^|\n)#{1,6}\s|\*\*[^*\n]+\*\*/.test(f);i.useEffect(()=>{const t=N=>{if(!p.current)return;const H=N.clientY-p.current.startY,M=Math.min(G,Math.max(F,p.current.startH+H));x(M)},l=()=>{p.current=null};return window.addEventListener("mousemove",t),window.addEventListener("mouseup",l),()=>{window.removeEventListener("mousemove",t),window.removeEventListener("mouseup",l)}},[]);const j=t=>{t.preventDefault(),p.current={startY:t.clientY,startH:g||v}};return e.jsxs("div",{className:"rounded-2xl p-6 bg-card border border-border relative",children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsx("h2",{className:"text-lg font-semibold text-foreground",children:d("ev.about","About This Event")}),m&&e.jsx(C,{variant:"ghost",size:"sm",className:"h-7 text-xs",onClick:()=>{n?(h(!1),x(0)):(h(!0),x(v))},children:n?e.jsxs(e.Fragment,{children:[e.jsx(L,{className:"w-3 h-3 mr-1"})," ",a("Expand","Ampliar")]}):e.jsxs(e.Fragment,{children:[e.jsx(I,{className:"w-3 h-3 mr-1"})," ",a("Collapse","Contraer")]})})]}),(()=>{const t="text-sm leading-relaxed text-muted-foreground overflow-y-auto pr-1 prose prose-sm max-w-none prose-p:my-2 prose-strong:text-foreground prose-headings:text-foreground prose-headings:font-bold prose-h1:text-lg prose-h2:text-base prose-h3:text-[15px] prose-headings:mt-4 prose-headings:mb-1.5",l=n?{maxHeight:g,height:g}:void 0;return k?e.jsx("div",{className:t,style:l,children:e.jsx(b,{children:f})}):c?e.jsx("div",{className:t,style:l,dangerouslySetInnerHTML:{__html:y}}):w?e.jsx("div",{className:t,style:l,children:e.jsx(b,{children:o})}):e.jsx("div",{className:`${t} whitespace-pre-wrap`,style:l,children:o})})(),n&&e.jsx("div",{role:"separator","aria-label":a("Resize description","Cambiar el tamaño de la descripción"),onMouseDown:j,className:"absolute bottom-2 right-2 flex items-center justify-center w-6 h-6 rounded-md bg-secondary/70 hover:bg-secondary border border-border cursor-ns-resize",title:a("Drag to resize","Arrastre para cambiar el tamaño"),children:e.jsx(z,{className:"w-3 h-3 text-muted-foreground"})})]})}function Q({score:o=0,size:r=56,strokeWidth:d=4}){const m=(r-d)/2,a=2*Math.PI*m,n=Math.max(0,Math.min(100,o)),h=n>=80?"#14B8A6":n>=50?"#F59E0B":"#EF4444";return e.jsxs("div",{className:"relative grid place-items-center",style:{width:r,height:r},children:[e.jsxs("svg",{width:r,height:r,className:"-rotate-90",children:[e.jsx("circle",{cx:r/2,cy:r/2,r:m,fill:"none",stroke:"currentColor",strokeWidth:d,className:"opacity-15"}),e.jsx("circle",{cx:r/2,cy:r/2,r:m,fill:"none",stroke:h,strokeWidth:d,strokeLinecap:"round",strokeDasharray:a,strokeDashoffset:a-n/100*a})]}),e.jsx("span",{className:"absolute font-bold",style:{fontSize:r*.3},children:Math.round(n)})]})}export{V as B,K as C,Q as O,J as S,I as a,X as b};
