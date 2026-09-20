import { useState } from 'react';
import { useOneId, useI18n, W, ScreenHeading, HostShowings, SegTabs } from '@oneworld/shell';
import RentalRequests from '../components/RentalRequests';
import { StayReviewTasks } from '../components/StayReviews';

/**
 * SHOWINGS & REQUESTS — one page, one thing on it at a time.
 * ============================================================================================
 * Lee, 20 September 2026, on the property screens:
 *
 *   *"You can't be showing all this on the screen at one time… maybe put viewing requests and
 *    rental requests on one page and you can have a little slider at the top so people can toggle
 *    between viewing requests and rental requests, and then you actually put your listings on a
 *    dedicated page."*
 *
 * ── WHAT WAS WRONG ──────────────────────────────────────────────────────────────────────────
 * Two problems, and the second one is why the first was so easy to miss.
 *
 * 1 · This page stacked three unrelated queues vertically — rental requests, review tasks,
 *     viewing appointments — so a host with activity on all three had to scroll past two to
 *     reach the one they came for, and a host with activity on none scrolled past three empty
 *     states to learn that.
 *
 * 2 · `MyProperties` rendered the SAME two components again, directly above the listings. The
 *     identical queue existed twice, one tap apart, and nothing said which was authoritative.
 *     That is now gone from there: the portfolio page is listings, this page is requests, and
 *     `MyProperties` links here with the waiting count on the row.
 *
 * ── WHY THE TOGGLE AND NOT TWO PAGES ────────────────────────────────────────────────────────
 * These are the same decision at two stages — somebody wants your place, and somebody wants to
 * see it first — so a host checking one almost always wants a glance at the other. A toggle
 * keeps that a thumb-flick. Two routes would make it a back-navigation, and Lee's own framing
 * ("one page… a little slider at the top") is the right read.
 *
 * The count rides on the tab label, so the tab you are NOT looking at can still tell you it
 * needs you. A toggle that hides a number is a toggle that hides work.
 */
type Tab = 'rental' | 'viewing';

export default function Requests() {
  const { userId } = useOneId();
  const { lang } = useI18n();
  const [tab, setTab] = useState<Tab>('rental');
  /* `HostShowings` reports how many are waiting. Held here rather than inside the viewing tab so
     the number survives a trip to the other tab — a count that resets when you look away is a
     count you cannot trust. */
  const [pending, setPending] = useState(0);

  /* Host and guest are two different questions — appointments at MY place, versus visits I have
     asked for somewhere else — so this stays a switch inside the viewing tab rather than being
     flattened into the top-level toggle, which is about WHAT the queue is, not whose. */
  const [role, setRole] = useState<'host' | 'guest'>('host');

  return (
    <div className="space-y-4 pb-28">
      <ScreenHeading>{W(lang, 'Showings & requests', 'Visitas y solicitudes')}</ScreenHeading>

      <SegTabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'rental', label: W(lang, 'Rental requests', 'Solicitudes de arriendo') },
          {
            value: 'viewing',
            label: (
              <span className="inline-flex items-center gap-1.5">
                {W(lang, 'Viewings', 'Visitas')}
                {pending > 0 && (
                  <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10.5px] font-black tabular-nums text-white">
                    {pending}
                  </span>
                )}
              </span>
            ),
          },
        ]}
      />

      {/* ⚠️ BOTH ARE MOUNTED, ONE IS HIDDEN. `hidden` keeps the inactive tab out of the layout
          and out of the tab order while leaving it mounted, so `HostShowings` keeps reporting its
          count into the label above and switching tabs does not re-run its query. Unmounting the
          viewing tab would zero the badge on the tab you are not looking at, which is the one
          piece of information the badge exists to carry. */}
      <div hidden={tab !== 'rental'} className="space-y-4">
        <RentalRequests heading={false} />
        <StayReviewTasks lang={lang} />
      </div>

      <div hidden={tab !== 'viewing'} className="space-y-3">
        {userId && (
          <>
            <SegTabs<'host' | 'guest'>
              size="sm"
              value={role}
              onChange={setRole}
              options={[
                { value: 'host', label: W(lang, 'At my places', 'En mis inmuebles') },
                { value: 'guest', label: W(lang, 'Visits I asked for', 'Visitas que pedí') },
              ]}
            />
            <HostShowings key={`${userId}:${role}`} userId={userId} role={role} lang={lang}
              product="rentals" onCount={role === 'host' ? setPending : undefined} />
          </>
        )}
      </div>
    </div>
  );
}
