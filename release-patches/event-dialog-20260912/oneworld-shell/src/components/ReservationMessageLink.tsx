import { Link } from 'react-router-dom';
import { W } from '../lib/i18n';
export function reservationMessagePath(meta: Record<string,unknown>|undefined,userId:string|null) {
  if(!meta || !userId) return null;
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(typeof meta.request_id!=='string'||!uuid.test(meta.request_id)||typeof meta.property_id!=='string'||!uuid.test(meta.property_id))return null;
  const host=userId===meta.host_id;
  if(!host && userId!==meta.guest_id)return null;
  return `/rentals/r/${meta.property_id}${host?'/contract':''}?request=${meta.request_id}`;
}
export default function ReservationMessageLink({metadata,userId,lang}:{metadata?:Record<string,unknown>;userId:string|null;lang:string}) {
  const path=reservationMessagePath(metadata,userId);
  if(!path)return null;
  return <Link to={path} className="ow-tap mt-2 inline-flex items-center gap-2 rounded-xl border border-brand/40 px-3 py-2 text-sm font-bold">{metadata?.event==='rental_booking_request'?W(lang,'New reservation request','Nueva solicitud de reserva'):W(lang,'Open reservation','Abrir reserva')}<span aria-hidden="true">→</span></Link>;
}
