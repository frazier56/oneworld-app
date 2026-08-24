import{a2 as u}from"./index-CZ-dfwu4.js";/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}]],f=u("credit-card",d);/**
 * @license lucide-react v1.30.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const s=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]],l=u("plus",s);function i(e){const t=String(e.status||"").toLowerCase();return t==="cancelled"||t==="canceled"||t&&t!=="registered"&&t!=="checked-in"&&t!=="checked_in"?!1:!!(c(e)||r(e)||e.registration_source==="free"&&e.payment_status==="free"||e.registration_source==="promo"&&["paid","free","complimentary"].includes(String(e.payment_status||"")))}function r(e){return e.registration_source==="complimentary"||e.payment_status==="complimentary"}function c(e){return e.registration_source==="paid"&&e.payment_status==="paid"&&Number(e.amount_paid??0)>0}function m(e){return i(e)?Math.max(1,Number(e.quantity??1)):0}function p(e){return e.reduce((t,n)=>{const a=m(n);return t.totalAttendance+=a,r(n)?t.complimentaryAttendees+=a:c(n)&&(t.paidAttendees+=a),t.checkedInAttendees+=Math.max(0,Number(n.checked_in_count??0)),t},{totalAttendance:0,paidAttendees:0,complimentaryAttendees:0,checkedInAttendees:0})}function y(e){return e.reduce((t,n)=>!c(n)||n.status==="cancelled"||n.status==="canceled"?t:t+Math.max(0,Number(n.amount_paid??0)),0)}export{f as C,l as P,y as a,r as b,p as c,i};
