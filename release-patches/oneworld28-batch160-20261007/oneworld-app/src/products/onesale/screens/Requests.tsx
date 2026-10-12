import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOneId, useI18n, W, ScreenHeading, HostShowings, SegTabs, productHref } from '@oneworld/shell';

/**
 * SHOWINGS — the seller's side of "can I come and see it".
 * ============================================================================================
 * ⚠️ THIS PAGE DID NOT EXIST, AND THE ROW THAT LINKS TO IT DID.
 *
 * `MyListings` has carried the amber "Showings & requests" row for weeks: the right icon, the
 * right words, a live count fed by `HostShowings` with `product="sales"` — and a destination of
 * `productHref("onerental", "/requests")`. A seller tapped a badge that said "2 waiting on you",
 * counted from their SALE listings, and landed on their RENTAL requests page, which is a
 * different queue and for most sellers an empty one.
 *
 * That is the worst shape a defect can take. Nothing looks broken. The count is real, the row is
 * real, the page it opens is real — and the two have nothing to do with each other, so a seller
 * concludes the request they were told about has vanished. Meanwhile `ShowingRequest` is live on
 * the sale detail page, so buyers genuinely are booking viewings into this.
 *
 * Found in the rent/sale twins audit, 28 September 2026. Lee: *"If one feature is on one side,
 * then it needs to be on the other in the same exact way, like twins."*
 *
 * ── WHY THIS IS SHORTER THAN THE RENT SIDE'S TWIN ───────────────────────────────────────────
 * The rent page carries two queues behind a toggle — rental requests and viewings — because
 * renting has a second stage: somebody wants to see it, and then somebody wants to take it. A
 * sale has no equivalent second queue in this product. A Colombian sale closes through attorneys
 * and the purchase price never passes through us (Lee, 10 Aug), so there is no "offer" object to
 * queue here and inventing one would be inventing a product decision.
 *
 * So the outer toggle is absent ON PURPOSE, and its absence is the nuance rather than a gap. What
 * IS kept identical: the heading, the back link's shape and wording, the host/guest switch, the
 * `pb-28`, and the fact that the count on this page and the badge on the portfolio come from the
 * same component and therefore cannot disagree.
 */
export default function SaleRequests() {
  const { userId } = useOneId();
  const { lang } = useI18n();

  /* MY listings versus places I asked to see — two different questions, same as the rent side.
     Kept as a switch inside the page rather than two routes: a seller checking one usually wants
     a glance at the other, and a route change makes that a back-navigation. */
  const [role, setRole] = useState<'host' | 'guest'>('host');

  return (
    <div className="space-y-4 pb-28">
      <Link to={productHref('onesale', '/properties')}
        className="ow-tap inline-flex items-center gap-1 text-[13px] font-bold opacity-65">
        <span aria-hidden>‹</span>{W(lang, 'Back to my properties for sale', 'Volver a mis inmuebles en venta')}
      </Link>
      <ScreenHeading>{W(lang, 'Showings', 'Visitas')}</ScreenHeading>

      {userId && (
        <>
          <SegTabs<'host' | 'guest'>
            size="sm"
            value={role}
            onChange={setRole}
            options={[
              { value: 'host', label: W(lang, 'At my listings', 'En mis anuncios') },
              { value: 'guest', label: W(lang, 'Visits I asked for', 'Visitas que pedí') },
            ]}
          />
          {/* `key` forces a clean remount on the switch so a stale list from the other role can
              never be shown under the new heading — the same guard the rent side uses. */}
          <HostShowings key={`${userId}:${role}`} userId={userId} role={role} lang={lang}
            product="sales" />
        </>
      )}
    </div>
  );
}
