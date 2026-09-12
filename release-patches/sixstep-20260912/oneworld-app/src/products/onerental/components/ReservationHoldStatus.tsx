import { useEffect, useState } from 'react';
import { W } from '@oneworld/shell';
export default function ReservationHoldStatus({deadline,paymentReported=false,lang}:{deadline:string|null;paymentReported?:boolean;lang:string}) {
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
  const end=deadline ? Date.parse(deadline) : NaN;
  if(paymentReported) return <p role="status" className="mt-2 text-sm font-semibold">{W(lang,'Payment under review — dates remain held while receipt is checked.','Pago en revisión: las fechas siguen reservadas mientras se verifica la recepción.')}</p>;
  if(!Number.isFinite(end)) return <p className="mt-2 text-xs opacity-70">{W(lang,'Dates are not held until the host pre-approves. Do not send payment yet.','Las fechas no se reservan hasta la preaprobación del anfitrión. No envíe el pago todavía.')}</p>;
  if(end<=now) return <p role="status" className="mt-2 text-sm font-semibold">{W(lang,'Payment window expired. Do not send money; contact the host.','El plazo de pago venció. No envíe dinero; contacte al anfitrión.')}</p>;
  const minutes=Math.ceil((end-now)/60000);
  const date=new Intl.DateTimeFormat(lang==='es'||lang==='co'?'es-CO':'en-US',{timeZone:'America/Bogota',dateStyle:'medium',timeStyle:'short'}).format(end);
  return <p role="status" className="mt-2 text-sm font-semibold">{W(lang,`Dates held · ${Math.floor(minutes/60)}h ${minutes%60}m left to report payment. Deadline: ${date}, Colombia time.`,`Fechas reservadas · ${Math.floor(minutes/60)}h ${minutes%60}m para informar el pago. Plazo: ${date}, hora de Colombia.`)}</p>;
}
