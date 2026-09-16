import { useState } from 'react';
import { useOneId, useI18n, W, ScreenHeading, HostShowings } from '@oneworld/shell';
import RentalRequests from '../components/RentalRequests';
import { StayReviewTasks } from '../components/StayReviews';
export default function Requests() {
  const { userId } = useOneId();
  const { lang } = useI18n();
  const [role, setRole] = useState<'host' | 'guest'>('host');
  return <div className="space-y-6">
    <ScreenHeading>{W(lang, 'Showings & requests', 'Visitas y solicitudes')}</ScreenHeading>
    <RentalRequests />
    <StayReviewTasks lang={lang} />
    {userId && <section className="space-y-3">
      <h2 className="text-sm font-bold">{W(lang, 'Viewing appointments', 'Citas para visitas')}</h2>
      <div className="flex gap-2">{(['host', 'guest'] as const).map(value => <button key={value} aria-pressed={role === value} className={role === value ? 'btn-brand' : 'btn-ghost'} onClick={() => setRole(value)}>{value === 'host' ? W(lang, 'My listings', 'Mis anuncios') : W(lang, 'My visits', 'Mis visitas')}</button>)}</div>
      <HostShowings key={`${userId}:${role}`} userId={userId} role={role} lang={lang} product="rentals" />
    </section>}
  </div>;
}
