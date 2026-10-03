// Loads Stripe.js from the CDN once (no npm dependency added to the app).
// Used by AddCardSheet (Elements/SetupIntent) and PaymentSheet (3DS confirmCardPayment).
let p: Promise<any> | null = null;
export function loadStripeJs(publishableKey: string): Promise<any> {
  if (p) return p;
  p = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.Stripe) return resolve(w.Stripe(publishableKey));
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3/";
    s.async = true;
    s.onload = () => resolve((window as any).Stripe(publishableKey));
    s.onerror = () => reject(new Error("Failed to load Stripe.js"));
    document.head.appendChild(s);
  });
  return p;
}
