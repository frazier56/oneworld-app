import { supabase } from "./supabase";
import { fnError } from "./fnError";

/**
 * Hand a freshly-sent contract to the server so the counterparty actually finds out about it.
 *
 * Lee, Jul 25 2026: "the person receiving it should get a notification — a bell, and it should show
 * in Messages. And if they're not on the app, they get the email, they sign up, and it takes them
 * DIRECTLY to the contract. Not to no home page."
 *
 * All three of those are cross-user writes, and the browser cannot legitimately do any of them:
 *   - `notifications` RLS only lets you write rows for yourself
 *   - opening a conversation on someone else's behalf needs the same privilege
 *   - the invite email needs an address the client should never be handed
 *
 * `contract-notify` does the lot with the service role after checking the caller is a party to the
 * contract. One call, one round trip.
 */
export type ContractDelivery = {
  ok: boolean;
  /** Whether the counterparty can sign in today. False = they were emailed an invite instead. */
  recipientHasAccount?: boolean;
  notified?: boolean;
  conversationId?: string | null;
  emailQueued?: boolean;
  emailSent?: boolean;
  /** Public /contract/<token> URL — usable as a "copy link" fallback if email is still pending. */
  inviteLink?: string | null;
  error?: string;
};

export async function deliverContract(agreementId: string): Promise<ContractDelivery> {
  if (!agreementId) return { ok: false, error: "Missing contract id." };
  try {
    const { data, error } = await supabase.functions.invoke("contract-notify", {
      body: { agreementId },
    });
    if (error) {
      return { ok: false, error: await fnError(error, "Contract saved, but we couldn't notify them. Try resending.") };
    }
    const d = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      recipientHasAccount: d.recipient_has_account as boolean | undefined,
      notified: d.notified as boolean | undefined,
      conversationId: (d.conversation_id as string | null) ?? null,
      emailQueued: d.email_queued as boolean | undefined,
      emailSent: d.email_sent as boolean | undefined,
      inviteLink: (d.invite_link as string | null) ?? null,
    };
  } catch (e) {
    // Delivery is best-effort by design: the contract itself is already saved and paid for. Losing
    // the bell must never look to the sender like losing the contract.
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't notify them just now." };
  }
}
