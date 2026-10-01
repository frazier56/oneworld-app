import { useEffect, useState } from 'react';
import { supabase, useOneId, Toggle, W } from '@oneworld/shell';

type Prefs = { email: boolean; sms: boolean; email_ready: boolean; sms_ready: boolean };
export default function ReservationNotificationSettings({ lang }: { lang: string }) {
  const { userId } = useOneId();
  const [state, setState] = useState<{ user: string | null; prefs?: Prefs; error?: boolean }>({user:null});
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    let active = true;
    setState({user:userId}); setSaveError(false);
    if (userId) void (async () => {
      try {
        const {data,error}=await supabase.rpc('onehome_notification_settings');
        if(error || !data) throw error || Error('Unavailable');
        if(active) setState({user:userId,prefs:data as Prefs});
      } catch { if(active) setState({user:userId,error:true}); }
    })();
    return () => { active=false; };
  }, [userId,retry]);
  if (!userId) return null;
  const prefs = state.user === userId ? state.prefs : undefined;
  async function save(key: 'email'|'sms', value: boolean) {
    if (!prefs || busy) return;
    setBusy(true); setSaveError(false);
    try {
      const next={...prefs,[key]:value};
      const {data,error}=await supabase.rpc('set_onehome_notification_settings',{p_email:next.email,p_sms:next.sms});
      if(error || !data) throw error || Error('Unavailable');
      setState({user:userId,prefs:data as Prefs});
    } catch { setSaveError(true); } finally { setBusy(false); }
  }
  return <section className="card space-y-3 p-4" aria-label={W(lang,'Reservation notifications','Avisos de reservas')}>
    <h2 className="text-sm font-black">{W(lang,'Reservation notifications','Avisos de reservas')}</h2>
    <p className="text-xs leading-relaxed opacity-70">{W(lang,'Requests and updates always appear in Alerts and Messages. Add email or text messages for your OneHome reservations. These settings save separately from your listing.','Las solicitudes y actualizaciones siempre aparecen en Avisos y Mensajes. Agregue correo o SMS para sus reservas de OneHome. Estos ajustes se guardan por separado del anuncio.')}</p>
    {state.user===userId && state.error ? <div role="alert"><p>{W(lang,'Could not load your choices.','No se pudieron cargar sus preferencias.')}</p><button type="button" className="btn-ghost" onClick={()=>setRetry(x=>x+1)}>{W(lang,'Try again','Reintentar')}</button></div> : !prefs ? <p role="status">{W(lang,'Loading…','Cargando…')}</p> : <>
      <fieldset disabled={busy || (!prefs.email_ready && !prefs.email)} className="disabled:opacity-60"><Toggle on={prefs.email} onChange={value=>void save('email',value)} label={W(lang,'Email','Correo electrónico')} note={prefs.email_ready ? W(lang,'Send reservation updates to my verified email.','Enviar actualizaciones a mi correo verificado.') : W(lang,'Verify your email in account setup to enable this.','Verifique su correo en la configuración de su cuenta para activar esta opción.')} /></fieldset>
      <fieldset disabled={busy || (!prefs.sms_ready && !prefs.sms)} className="disabled:opacity-60"><Toggle on={prefs.sms} onChange={value=>void save('sms',value)} label={W(lang,'SMS text messages','Mensajes SMS')} note={prefs.sms_ready ? W(lang,'I agree to receive reservation texts at my verified phone. Message and data rates may apply. Turn this off here at any time.','Acepto recibir SMS de reservas en mi teléfono verificado. Pueden aplicarse tarifas de mensajes y datos. Puede desactivar esta opción aquí.') : W(lang,'Verify your phone in account setup to enable this.','Verifique su teléfono en la configuración de su cuenta para activar esta opción.')} /></fieldset>
      {busy && <p role="status" className="text-xs">{W(lang,'Saving…','Guardando…')}</p>}
    </>}
    {saveError && <p role="alert" className="text-sm text-red-600">{W(lang,'Your choice was not saved. Please try again.','Su preferencia no se guardó. Intente de nuevo.')}</p>}
  </section>;
}
