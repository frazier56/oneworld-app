import { useEffect, useState } from "react";
import AskVaiaChat from "./AskVaiaChat";

/** Single mounted instance of the real recovered VAIA popup (AskVaiaChat).
 *  The subheader "Tap for insights" pill (VaiaSubheader) dispatches the
 *  `os-vaia-open` window event; this wrapper owns the open/close state and
 *  renders the authentic centered popup with live voice transcription.
 *  Replaces the old bottom-sheet VaiaChat. */
export default function VaiaChatMount() {
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

  return <AskVaiaChat open={open} onClose={() => setOpen(false)} />;
}
