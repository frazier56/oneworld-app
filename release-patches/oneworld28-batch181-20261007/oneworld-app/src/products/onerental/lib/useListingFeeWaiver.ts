import { useEffect, useState } from 'react';
import { supabase } from '@oneworld/shell';
export function useListingFeeWaiver(propertyId?: string | null) {
  const [state, setState] = useState<{ id?: string | null; waived: boolean; pending: boolean; error?: boolean }>({ waived: false, pending: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    if (!propertyId) { setState({ id: propertyId, waived: false, pending: false }); return; }
    setState({ id: propertyId, waived: false, pending: true });
    (async () => {
      try {
        const { data, error } = await supabase.rpc('rental_fee_preview', { p_property_id: propertyId });
        if (error) throw error;
        if (alive) setState({ id: propertyId, waived: data?.listing_waived === true, pending: false });
      } catch { if (alive) setState({ id: propertyId, waived: false, pending: false, error: true }); }
    })();
    return () => { alive = false; };
  }, [propertyId, revision]);
  return { ...(state.id === propertyId ? state : { id: propertyId, waived: false, pending: true }), retry: () => setRevision(x => x + 1) };
}
