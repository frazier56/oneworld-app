export type EventRegistrationLike = {
  status?: string | null;
  quantity?: number | null;
  checked_in_count?: number | null;
  registration_source?: string | null;
  payment_status?: string | null;
  amount_paid?: number | null;
};

export type EventAttendanceCounts = {
  totalAttendance: number;
  paidAttendees: number;
  complimentaryAttendees: number;
  checkedInAttendees: number;
};

export function isConfirmedRegistration(registration: EventRegistrationLike): boolean {
  const status = String(registration.status || "").toLowerCase();
  if (status === "cancelled" || status === "canceled") return false;
  if (status && status !== "registered" && status !== "checked-in" && status !== "checked_in") return false;

  if (isPaidRegistration(registration)) return true;
  if (isComplimentaryRegistration(registration)) return true;
  if (registration.registration_source === "free" && registration.payment_status === "free") return true;
  if (
    registration.registration_source === "promo" &&
    ["paid", "free", "complimentary"].includes(String(registration.payment_status || ""))
  ) return true;
  return false;
}

export function isComplimentaryRegistration(registration: EventRegistrationLike): boolean {
  return registration.registration_source === "complimentary" || registration.payment_status === "complimentary";
}

export function isPaidRegistration(registration: EventRegistrationLike): boolean {
  return (
    registration.registration_source === "paid" &&
    registration.payment_status === "paid" &&
    Number(registration.amount_paid ?? 0) > 0
  );
}

export function getActiveTicketQuantity(registration: EventRegistrationLike): number {
  if (!isConfirmedRegistration(registration)) return 0;
  return Math.max(1, Number(registration.quantity ?? 1));
}

export function calculateEventAttendanceCounts(registrations: EventRegistrationLike[]): EventAttendanceCounts {
  return registrations.reduce<EventAttendanceCounts>(
    (counts, registration) => {
      const quantity = getActiveTicketQuantity(registration);
      counts.totalAttendance += quantity;

      if (isComplimentaryRegistration(registration)) {
        counts.complimentaryAttendees += quantity;
      } else if (isPaidRegistration(registration)) {
        counts.paidAttendees += quantity;
      }

      counts.checkedInAttendees += Math.max(0, Number(registration.checked_in_count ?? 0));
      return counts;
    },
    { totalAttendance: 0, paidAttendees: 0, complimentaryAttendees: 0, checkedInAttendees: 0 }
  );
}

export function calculateEventRevenue(registrations: EventRegistrationLike[]): number {
  return registrations.reduce((total, registration) => {
    if (!isPaidRegistration(registration)) return total;
    if (registration.status === "cancelled" || registration.status === "canceled") return total;
    return total + Math.max(0, Number(registration.amount_paid ?? 0));
  }, 0);
}
