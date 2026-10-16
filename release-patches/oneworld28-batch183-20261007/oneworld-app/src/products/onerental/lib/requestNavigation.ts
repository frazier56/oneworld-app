import { supabase } from '@oneworld/shell';
export type RentalRequest = {
  id: string; property_id: string; guest_id: string; starts_on: string; ends_on: string;
  quoted_total: number; currency: string; state: string; guest_total: number; host_net: number;
  guest_name: string | null; hostId: string; title: string; contract_id: string | null;
};
/** Explicit party filters remain necessary even when an admin session has broader RLS. */
export async function loadRentalRequests(userId: string, conversationId?: string, history = false): Promise<RentalRequest[]> {
  let propertyIds: string[] | undefined;
  let participants: string[] | undefined;
  if (conversationId) {
    const { data: conversation, error } = await supabase.from('conversations')
      .select('participant_ids').eq('id', conversationId).contains('participant_ids', [userId]).maybeSingle();
    if (error) throw error;
    if (!conversation?.participant_ids?.includes(userId)) return [];
    participants = conversation.participant_ids;
    const tags = await supabase.from('rental_conversation_tags').select('property_id').eq('conversation_id', conversationId);
    if (tags.error) throw tags.error;
    propertyIds = (tags.data ?? []).map(t => t.property_id).filter(Boolean);
    if (!propertyIds.length) return [];
  }
  const owned = await supabase.from('rental_properties').select('id').eq('agent_id', userId);
  if (owned.error) throw owned.error;
  const ownedIds = (owned.data ?? []).map(p => p.id);
  let query = supabase.from('rental_booking_requests')
    .select('id, property_id, guest_id, guest_name, starts_on, ends_on, quoted_total, currency, state, guest_total, host_net, contract_id')
    .order('created_at', { ascending: false }).limit(100);
  query = ownedIds.length ? query.or(`guest_id.eq.${userId},property_id.in.(${ownedIds.join(',')})`) : query.eq('guest_id', userId);
  query = history && !conversationId ? query.not('state', 'in', '(requested,accepted)') : query.in('state', ['requested', 'accepted']);
  if (propertyIds) query = query.in('property_id', propertyIds).in('guest_id', participants!);
  const { data, error } = await query;
  if (error) throw error;
  if (!data?.length) return [];
  const props = await supabase.from('rental_properties').select('id, agent_id, title').in('id', [...new Set(data.map(r => r.property_id))]);
  if (props.error) throw props.error;
  const names = await supabase.from('profiles').select('id, full_name').in('id', [...new Set(data.map(r => r.guest_id))]);
  // A profile may be private. Preserve saved guest_name or a neutral label in that case.
  return data.flatMap(r => {
    const p = props.data?.find(p => p.id === r.property_id);
    if (!p || (p.agent_id !== userId && r.guest_id !== userId)) return [];
    if (participants && !participants.includes(p.agent_id)) return [];
    return [{ ...r, hostId: p.agent_id, title: p.title, guest_name: names.data?.find(n => n.id === r.guest_id)?.full_name ?? r.guest_name }];
  });
}
