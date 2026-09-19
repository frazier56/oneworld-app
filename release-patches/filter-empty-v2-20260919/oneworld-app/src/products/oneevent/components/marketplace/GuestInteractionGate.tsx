// Passthrough gate: renders children (guest interaction restrictions relaxed for
// the OneEvent surface; auth is enforced at the route/Shell level).
export function GuestInteractionGate({ children }: { children?: React.ReactNode; [k: string]: any }) {
  return <>{children}</>;
}
export default GuestInteractionGate;
