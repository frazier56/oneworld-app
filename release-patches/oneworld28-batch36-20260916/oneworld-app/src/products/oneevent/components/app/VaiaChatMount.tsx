import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { productFromPath } from "@oneworld/shell";
import AskVaiaChat from "./AskVaiaChat";

/** Single mounted instance of the real recovered VAIA popup (AskVaiaChat).
 *  The subheader "Tap for insights" pill (VaiaSubheader) dispatches the
 *  `os-vaia-open` window event; this wrapper owns the open/close state and
 *  renders the authentic centered popup with live voice transcription.
 *  Replaces the old bottom-sheet VaiaChat. */
/* Mounted ONCE, at the app root, above every product (see `App.tsx`). It used to be mounted
   inside OneEvent's own route tree, which is why VAIA existed on exactly one of eight products.

   The product is read from the URL rather than passed per route: `productFromPath` is the shell's
   single answer to "which product is this path", so a new product gets VAIA the moment it gets a
   route, and nobody has to remember to wire her up. `/rentals` and `/sales` both resolve to their
   own keys and both map to OneHome's knowledge base server-side. */
export default function VaiaChatMount({ product }: { product?: string } = {}) {
  const loc = useLocation();
  const here = product ?? productFromPath(loc.pathname) ?? "onesocial";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openH = () => setOpen(true);
    /* BUG FIX (Lee's VAIA pass, 17 Aug 2026): the SHELL subheader dispatches `ow-vaia-open`;
       this mount listened only for the old `os-vaia-open` — tapping VAIA did nothing. */
    window.addEventListener("ow-vaia-open", openH);
    window.addEventListener("os-vaia-open", openH);
    return () => {
      window.removeEventListener("ow-vaia-open", openH);
      window.removeEventListener("os-vaia-open", openH);
    };
  }, []);

  return <AskVaiaChat open={open} onClose={() => setOpen(false)} product={here} />;
}
