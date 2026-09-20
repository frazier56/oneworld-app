import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, useAsync, W } from '@oneworld/shell';
import { monthlyStay, ownerTermLines } from '../lib/monthly';
import { D } from '../lib/detailCopy';
import { clockTime } from '../lib/stayFacts';

/* ⚠️ THIS PANEL IS NO LONGER ON THE PUBLIC LISTING. 17 September 2026.
   Its real job is managing an ONGOING tenancy — renew, give notice, see what is paid — and it was
   rendering on `/rentals/r/:id`, where a stranger browsing a listing was shown the dashboard for
   a relationship they do not have. It now mounts only on the two contract screens, which is where
   somebody with a tenancy actually is. See `PropertyDetail.tsx` for what replaced it there. */
export default function MonthlyRentalPanel({propertyId,userId,hostId,amount,currency,lang,onRequestMonth,selectedRequestId,terms}: {
  propertyId:string; userId:string|null; hostId:string; amount:number; currency:string; lang:string;
  onRequestMonth?:(stay:ReturnType<typeof monthlyStay>)=>void;
  selectedRequestId?:string;
  /** The host's OWN terms, from the listing. Undefined means they were not loaded on this screen,
      which shows nothing — never OneHome's numbers wearing the host's name. */
  terms?: {owner_terms_enabled:boolean; lease_notice_days:number; payment_window_business_days:number; breach_penalty_months:number} | null;
}) {
  const [tick,setTick]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [accept,setAccept]=useState(false),[moveOut,setMoveOut]=useState('');
  const [selectedAgreement,setSelectedAgreement]=useState('');
  const existingStay=propertyId==='b8334d28-9200-4abb-b37a-716241ac09cb' && ['eeb6bced-c34b-4c73-8e3a-bd0498fe1b6c','95692fe9-e1d3-4f89-9c50-b50e276b738d'].includes(userId??'');
  const [month,setMonth]=useState(existingStay?'2026-09':new Date(new Date().getFullYear(),new Date().getMonth()+1,1,12).toISOString().slice(0,7));
  const agreements=useAsync(async()=>{
    if(!userId)return [];
    let query=supabase.from('rental_monthly_agreements').select('*,rental_monthly_periods(request_id)').eq('property_id',propertyId).is('declined_at',null).order('created_at',{ascending:false});
    const {data,error:e}=await query;
    if(e){setError(e.message);return [];}
    const filtered=selectedRequestId?(data??[]).filter((x:any)=>x.rental_monthly_periods?.some((p:any)=>p.request_id===selectedRequestId)):(data??[]);
    if(!filtered.length)return [];
    const {data:names}=await supabase.from('profiles').select('id,full_name').in('id',filtered.map(x=>x.guest_id));
    return filtered.map(x=>({...x,guest_name:names?.find(n=>n.id===x.guest_id)?.full_name??W(lang,'Tenant','Inquilino')}));
  },[propertyId,userId,tick,selectedRequestId]);
  const a=agreements?.find(x=>x.id===selectedAgreement)??agreements?.[0];
  const periods=useAsync(async()=>{
    if(!a)return [];
    const {data,error:e}=await supabase.from('rental_monthly_periods').select('request_id,starts_on,ends_on,rental_booking_requests(state,payment_status,guest_total,check_in_time,check_out_time)').eq('agreement_id',a.id).order('starts_on',{ascending:false});
    if(e)throw e;
    return data??[];
  },[a?.id,tick]);
  const notices=useAsync(async()=>{
    if(!a)return [];
    const {data,error:e}=await supabase.from('rental_monthly_notices').select('*').eq('agreement_id',a.id).is('withdrawn_at',null);
    if(e)throw e;
    return data??[];
  },[a?.id,tick]);
  const latest=periods?.[0], notice=notices?.[0];
  const lease=useAsync(async()=>{
    if(!periods?.length)return null;
    const {data}=await supabase.from('rental_contracts').select('id,status').in('booking_request_id',periods.map(x=>x.request_id)).order('created_at',{ascending:false}).limit(1).maybeSingle<any>();
    return data;
  },[a?.id,periods,tick]);
  const request=latest?.rental_booking_requests as any;
  const ownerTerms=ownerTermLines(terms as any);
  const money=(n:number)=>new Intl.NumberFormat(lang==='es'?'es-CO':'en-US',{style:'currency',currency:a?.currency??currency,maximumFractionDigits:0}).format(n);
  async function act(fn:()=>PromiseLike<{error:any}>) {
    setBusy(true);setError('');
    try {const result=await fn(); if(result.error)throw result.error;setTick(t=>t+1);setAccept(false);}catch(e:any){setError(e.message??String(e));}finally{setBusy(false);}
  }
  if(!userId)return null;
  return <section className="card space-y-3 p-4" aria-label={W(lang,'Monthly stay','Estadía mensual')}>
    <h2 className="text-lg font-black">{W(lang,'Month-to-month stay','Estadía mes a mes')}</h2>
    {agreements && agreements.length>1 && <select aria-label={W(lang,'Monthly agreement','Acuerdo mensual')} className="field w-full" value={a?.id} onChange={e=>{setSelectedAgreement(e.target.value);setAccept(false);}}>{agreements.map(x=><option key={x.id} value={x.id}>{x.guest_name} · {x.starts_on}</option>)}</select>}
    {a && userId===hostId && <p className="text-sm font-bold">{a.guest_name}</p>}
    <p className="text-sm font-bold">{money(a?.monthly_rent??amount)} / {W(lang,'calendar month','mes calendario')}</p>
    {/* ⛔ THREE INVENTED SENTENCES USED TO SIT HERE — identical on every property, agreed by
        nobody, hardcoded in `lib/monthly.ts`. They are deleted. What renders now is the numbers
        this host actually typed, and NOTHING AT ALL where the host typed none. */}
    {ownerTerms.length>0 && <>
      <h3 className="text-[12.5px] font-black">{D(lang,'hostTerms')}</h3>
      <ul className="space-y-1 text-[12.5px] leading-relaxed opacity-75">
        {ownerTerms.map(t=><li key={t.key}>
          {t.key==='notice'&&D(lang,'termNotice',{n:t.n})}
          {t.key==='payWindow'&&D(lang,'termPayWindow',{n:t.n})}
          {t.key==='breach'&&D(lang,t.n===1?'termBreach':'termBreachPl',{n:t.n})}
        </li>)}
      </ul>
      <p className="text-[11px] opacity-55">{D(lang,'termsFromHost')}</p>
    </>}
    {!a && <>
      {/* ⚠️ THIS LINE NAMED A MONTH. It read "August proration is separate" — in September, on a
          request for October, to a host who has never heard the word proration. It also promised
          this was "not a six-month commitment", answering a question nobody on a month-to-month
          screen was asking. What survives is the one fact it was there to give. */}
      <p className="text-xs opacity-70">{W(lang,'Proposed terms. The host still has to accept them.','Términos propuestos. El anfitrión todavía debe aceptarlos.')}</p>
      {userId!==hostId && onRequestMonth && <>
        <label className="block text-sm font-bold">{W(lang,'First month','Primer mes')}<input aria-label={W(lang,'First month','Primer mes')} type="month" value={month} onChange={e=>setMonth(e.target.value)} className="field mt-1 w-full"/></label>
        <button className="btn-primary w-full" disabled={!month} onClick={()=>{try{onRequestMonth(monthlyStay(month+'-01',amount));}catch(e:any){setError(e.message);}}}>{W(lang,'Request month to month','Solicitar mes a mes')}</button>
      </>}
    </>}
    {a && <>
      {lease && <Link className="block rounded-xl border border-brand/25 p-3 text-sm font-bold text-brand" to={`/rentals/c/${lease.id}`}>{W(lang,'Open original lease','Abrir contrato original')} · {lease.status}</Link>}
      <p className="rounded-xl bg-brand/10 p-3 text-sm font-bold">{a.host_accepted_at?W(lang,'Monthly terms accepted by both parties','Términos mensuales aceptados por ambas partes'):W(lang,'Proposal sent — waiting for the host to accept','Propuesta enviada — pendiente de aceptación del anfitrión')}</p>
      {userId===a.host_id && !a.host_accepted_at && <div className="flex flex-wrap gap-2">
        <button className="btn-primary flex-1" disabled={busy} onClick={()=>void act(()=>supabase.rpc('respond_monthly_rental',{p_agreement_id:a.id,p_accept:true}))}>{W(lang,'Accept monthly terms','Aceptar términos mensuales')}</button>
        <button className="btn-ghost" disabled={busy} onClick={()=>void act(()=>supabase.rpc('respond_monthly_rental',{p_agreement_id:a.id,p_accept:false}))}>{W(lang,'Decline proposal','Rechazar propuesta')}</button>
      </div>}
      {/* ⚠️ TWO FACTS WITH TIMES, AND TWO SENTENCES — BOTH FIXED 17 SEPTEMBER 2026.
          This line used to read `2026-09-01 → 2026-10-01 (checkout)`: one span with the word
          checkout bolted onto the end, which says what time nothing. And the status beneath it
          joined two facts about two different people with a dot — the host has not accepted, and
          no money has arrived — so a tenant could not tell which half was theirs to act on.
          They are separate sentences now, with the advice that only makes sense once they are. */}
      {periods?.map((p:any)=>{const accepted=p.rental_booking_requests?.state==='accepted';
        const paid=['received','captured'].includes(p.rental_booking_requests?.payment_status);
        const inAt=clockTime(p.rental_booking_requests?.check_in_time,lang);
        const outAt=clockTime(p.rental_booking_requests?.check_out_time,lang);
        return <div key={p.request_id} className="rounded-xl border border-ink/15 p-3 text-sm">
        <strong className="block">{D(lang,'stayFrom')}: {p.starts_on}{inAt?` · ${inAt}`:''}</strong>
        <strong className="block">{D(lang,'stayTo')}: {p.ends_on}{outAt?` · ${outAt}`:''}</strong>
        <p className="mt-1">{accepted?D(lang,'acceptedByHost'):D(lang,'notAcceptedYet')}</p>
        <p>{paid?D(lang,'paymentIsIn'):D(lang,'noPaymentYet')}</p>
        {!accepted && !paid && userId!==a.host_id && <p className="mt-1 font-bold">{D(lang,'waitToPay')}</p>}
        {userId===a.host_id && <Link className="font-bold text-brand underline" to={`/rentals/r/${propertyId}/contract?request=${p.request_id}`}>{W(lang,'Review request and payment','Revisar solicitud y pago')}</Link>}
      </div>;})}
      {userId===a.guest_id && a.host_accepted_at && !notice && latest && <>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={accept} onChange={e=>setAccept(e.target.checked)} className="mt-1 h-5 w-5"/>{W(lang,'Request the next calendar month on these same terms. Remitly payment remains pending until the host confirms receipt; no automatic charge.','Solicitar el siguiente mes calendario con estos términos. El pago por Remitly queda pendiente hasta confirmación del anfitrión; no hay cobro automático.')}</label>
        <button className="btn-primary w-full" disabled={busy||!accept||lease?.status!=='active'||request?.state!=='accepted'||!['received','captured'].includes(request?.payment_status)} onClick={()=>void act(()=>supabase.rpc('request_monthly_rental',{p_property_id:propertyId,p_starts_on:latest.ends_on,p_payment_rail:'remitly',p_accept_terms:true,p_agreement_id:a.id}))}>{W(lang,'Request next month','Solicitar el próximo mes')}</button>
        <p className="text-xs opacity-65">{W(lang,'Renewal unlocks after the original lease is signed and active, and the current month is approved and paid.','La renovación requiere contrato firmado y activo, y el mes actual aprobado y pagado.')}</p>
      </>}
      {a.host_accepted_at && lease?.status==='active' && !notice && <details className="rounded-xl border border-ink/15 p-3">
        <summary className="cursor-pointer text-sm font-bold">{W(lang,'Give 15-day move-out notice','Dar aviso de salida con 15 días')}</summary>
        <label className="mt-3 block text-sm">{W(lang,'Proposed checkout date','Fecha de salida propuesta')}<input type="date" value={moveOut} onChange={e=>setMoveOut(e.target.value)} className="field mt-1 w-full"/></label>
        <p className="my-2 text-xs">{W(lang,'This records notice and pauses renewals. Final rent and release of reserved dates require review; it does not automatically refund or charge money.','Registra el aviso y pausa renovaciones. El canon final y la liberación de fechas requieren revisión; no reembolsa ni cobra automáticamente.')}</p>
        <button className="btn-ghost w-full" disabled={busy||!moveOut} onClick={()=>void act(()=>supabase.rpc('give_monthly_rental_notice',{p_agreement_id:a.id,p_move_out_on:moveOut}))}>{W(lang,'Send notice','Enviar aviso')}</button>
      </details>}
      {notice && <div className="rounded-xl border border-brand/25 p-3 text-sm">
        <strong>{W(lang,'Move-out notice','Aviso de salida')}: {notice.move_out_on}</strong>
        <p>{notice.acknowledged_at?W(lang,'Acknowledged. Final rent still needs agreement.','Acusado de recibo. El canon final requiere acuerdo.'):W(lang,'Waiting for the other party to acknowledge. Renewals are paused.','Pendiente de acuse de la otra parte. Renovaciones pausadas.')}</p>
        {!notice.acknowledged_at && <button className="btn-ghost mt-2 w-full" disabled={busy} onClick={()=>void act(()=>supabase.rpc('respond_monthly_rental_notice',{p_notice_id:notice.id,p_withdraw:notice.actor_id===userId}))}>{notice.actor_id===userId?W(lang,'Withdraw notice','Retirar aviso'):W(lang,'Acknowledge notice','Acusar recibo')}</button>}
      </div>}
    </>}
    {error && <p role="alert" className="text-sm font-bold text-red-600">{error}</p>}
  </section>;
}
