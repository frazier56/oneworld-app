import * as React from "react";

// The app renders inside a max-w-lg (~512px) phone column on every device —
// on desktop it shows as a centered phone frame — so the effective content
// width is always phone-sized. Treat the app as mobile-layout everywhere for a
// consistent native feel and so wide desktop layouts never overflow the column.
const MOBILE_BREAKPOINT = 768;
const APP_COLUMN_MAX = 512;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(true);

  React.useEffect(() => {
    const compute = () => setIsMobile(Math.min(window.innerWidth, APP_COLUMN_MAX) < MOBILE_BREAKPOINT);
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return isMobile;
}
