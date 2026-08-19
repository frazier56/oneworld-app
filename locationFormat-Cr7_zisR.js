import{$ as s}from"./index-Wyv4bQuv.js";/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]],h=s("arrow-right",a);function m(n){if(!n)return"Remote";const r=n.trim();if(!r)return"Remote";const t=r.split(",").map(e=>e.trim()).filter(Boolean);if(t.length<=2)return r;const i=/^([A-Z]{2})\s*\d{0,5}$/;for(let e=1;e<t.length;e++){const o=t[e].match(i);if(o&&e>0)return`${t[e-1]}, ${o[1]}`}return t.length>=3?`${t[t.length-3]}, ${t[t.length-2]}`:`${t[0]}, ${t[1]}`}export{h as A,m as s};
