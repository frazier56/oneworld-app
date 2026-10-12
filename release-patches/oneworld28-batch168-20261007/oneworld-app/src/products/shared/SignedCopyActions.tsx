import { useState } from "react";
import { useI18n, W } from "@oneworld/shell";
import { shareOrDownload, downloadBlob, openPdf } from "./agreementPdf";

/**
 * The three things Lee asked a signed copy to do — share, save, print — on both halves of
 * OneHome. Labels, not sentences. The PDF is built once per tap and not cached: it is a
 * rendering of an immutable record, so building it again always gives the same document.
 */
export default function SignedCopyActions({ build, filename, title }: {
  build: () => Promise<Blob>;
  filename: string;
  title: string;
}) {
  const { lang } = useI18n();
  const [busy, setBusy] = useState<null | "share" | "save" | "print">(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (kind: "share" | "save" | "print") => {
    setBusy(kind); setErr(null);
    try {
      const blob = await build();
      if (kind === "share") await shareOrDownload(blob, filename, title);
      else if (kind === "save") downloadBlob(blob, filename);
      else openPdf(blob);
    } catch {
      setErr(W(lang, "The PDF could not be made. Try again.", "No se pudo crear el PDF. Intente de nuevo."));
    } finally { setBusy(null); }
  };

  return (
    <div>
      {/* Share is the main job (WhatsApp, email, Print all live in the phone's share sheet), so it
          gets the full row. Three equal buttons made "Compartir" overflow its box at phone width. */}
      <button type="button" className="btn-primary w-full" disabled={!!busy} onClick={() => run("share")}>
        {busy === "share" ? "…" : W(lang, "Share PDF", "Compartir PDF")}
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => run("save")}>
          {busy === "save" ? "…" : W(lang, "Download", "Descargar")}
        </button>
        <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => run("print")}>
          {busy === "print" ? "…" : W(lang, "Print", "Imprimir")}
        </button>
      </div>
      <p className="mt-1.5 text-[11.5px] opacity-55">
        {W(lang, "PDF · WhatsApp, email, or any Wi-Fi printer", "PDF · WhatsApp, correo o cualquier impresora Wi-Fi")}
      </p>
      {err && <p className="mt-2 text-[12px] font-semibold text-red-600 dark:text-red-400">{err}</p>}
    </div>
  );
}
