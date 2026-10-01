/**
 * agreementPdf — the signed copy as a real PDF file, for BOTH halves of OneHome.
 * ============================================================================================
 * Lee, 29 Sep 2026: *"they can convert it to a PDF and then email it, share it, print it ...
 * share it on WhatsApp ... they can view the PDF as well, and that stays within their documents.
 * They can always retrieve it."*
 *
 * ── WHY THE PDF IS BUILT ON THE PHONE AND NOT STORED ─────────────────────────────────────
 * The signed text, every signature image, every timestamp and the SHA-256 fingerprint already
 * live in the database and cannot be changed (guarded by triggers on both tables). The PDF is a
 * RENDERING of that record, rebuilt the same way every time — so there is no second copy in a
 * bucket to drift, leak, or need its own access rules. "Always retrieve it" is satisfied by the
 * record, which is the thing a court would ask for anyway.
 *
 * jsPDF is imported lazily: the 300-odd KB only loads when somebody actually opens a PDF.
 */

export type PdfSigner = {
  role: string;          // "Vendedor · Seller", already localised by the caller
  name: string | null;
  at: string | null;     // ISO timestamp, null = not signed yet
  png: string | null;    // data:image/png;base64,…
  ua?: string | null;    // the device it was signed on
};

export type AgreementPdfInput = {
  title: string;
  subtitle?: string;
  body: string;
  signers: PdfSigner[];
  sha256: string | null;
  sentAt?: string | null;
  completedAt?: string | null;
  lang: "en" | "es";
  draftNote?: string | null;
};

/* The standard PDF fonts are WinAnsi. Spanish letters are in it; box-drawing lines, arrows and
   ticks are not, and would print as garbage. Replace them with their plain equivalents. */
function pdfSafe(s: string): string {
  return s
    .replace(/[─━═]+/g, m => "-".repeat(Math.min(m.length, 60)))
    .replace(/→/g, "->").replace(/←/g, "<-")
    .replace(/[✓✔]/g, "OK").replace(/[•·]/g, "·")
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF—–·]/g, "");
}

const fmtTime = (iso: string, lang: "en" | "es") => {
  const d = new Date(iso);
  const local = d.toLocaleString(lang === "es" ? "es-CO" : "en-US", {
    dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota",
  });
  return `${local} (${lang === "es" ? "hora de Colombia" : "Colombia time"}) · ${d.toISOString().replace("T", " ").slice(0, 19)} UTC`;
};

export async function buildAgreementPdf(i: AgreementPdfInput): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const es = i.lang === "es";
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 56;
  const inner = W - M * 2;
  let y = M;

  const footer = () => {
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120);
      doc.text(pdfSafe(`OneHome · ${i.sha256 ? `${es ? "Huella" : "Fingerprint"} ${i.sha256.slice(0, 16)}…` : ""}`), M, H - 28);
      doc.text(`${p} / ${n}`, W - M, H - 28, { align: "right" });
    }
  };
  const need = (h: number) => { if (y + h > H - 56) { doc.addPage(); y = M; } };

  // ── Title ──
  doc.setTextColor(11, 15, 26);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  for (const line of doc.splitTextToSize(pdfSafe(i.title), inner)) { need(20); doc.text(line, M, y); y += 20; }
  if (i.subtitle) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90);
    for (const line of doc.splitTextToSize(pdfSafe(i.subtitle), inner)) { need(14); doc.text(line, M, y); y += 14; }
  }
  if (i.draftNote) {
    y += 4; doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(180, 83, 9);
    for (const line of doc.splitTextToSize(pdfSafe(i.draftNote), inner)) { need(12); doc.text(line, M, y); y += 12; }
  }
  y += 10;

  // ── Body ──
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(20);
  for (const para of pdfSafe(i.body).split("\n")) {
    if (!para.trim()) { y += 7; continue; }
    const heading = /^[A-ZÁÉÍÓÚÑ0-9 .,:;()\-—]{6,}$/.test(para.trim()) && para.trim().length < 90;
    doc.setFont("helvetica", heading ? "bold" : "normal");
    for (const line of doc.splitTextToSize(para, inner)) { need(14); doc.text(line, M, y); y += 14; }
  }

  // ── Signatures ──
  y += 16; need(40);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(11, 15, 26);
  doc.text(es ? "FIRMAS" : "SIGNATURES", M, y); y += 18;
  for (const s of i.signers) {
    need(110);
    doc.setDrawColor(210); doc.roundedRect(M, y, inner, 96, 6, 6);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(90);
    doc.text(pdfSafe(s.role.toUpperCase()), M + 12, y + 16);
    /* SIGNED = has a time. The drawing is optional: leases signed before 30 Sep 2026 were signed by
       typed name only, and printing "waiting for signature" on those would be false. */
    if (s.at) {
      if (s.png) { try { doc.addImage(s.png, "PNG", M + 12, y + 22, 170, 52, undefined, "FAST"); } catch { /* keep the text */ } }
      else {
        doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(120);
        doc.text(es ? "Firmado con nombre escrito" : "Signed by typed name", M + 12, y + 50);
      }
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(20);
      doc.text(pdfSafe(s.name ?? ""), M + 200, y + 34);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90);
      for (const [k, line] of doc.splitTextToSize(pdfSafe(fmtTime(s.at, i.lang)), inner - 212).entries())
        doc.text(line, M + 200, y + 48 + k * 11);
    } else {
      doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(150);
      doc.text(es ? "Pendiente de firma" : "Waiting for signature", M + 12, y + 50);
    }
    y += 108;
  }

  // ── Signing certificate (the DocuSign "certificate of completion") ──
  doc.addPage(); y = M;
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(11, 15, 26);
  doc.text(es ? "Certificado de firma" : "Signing certificate", M, y); y += 22;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(40);
  const rows: [string, string][] = [
    [es ? "Documento" : "Document", i.title],
    [es ? "Huella SHA-256 del texto firmado" : "SHA-256 fingerprint of the signed text", i.sha256 ?? "—"],
    ...(i.sentAt ? [[es ? "Enviado para firma" : "Sent for signature", fmtTime(i.sentAt, i.lang)] as [string, string]] : []),
    ...(i.completedAt ? [[es ? "Firmado por todas las partes" : "Signed by every party", fmtTime(i.completedAt, i.lang)] as [string, string]] : []),
  ];
  for (const s of i.signers) {
    rows.push([s.role, s.at
      ? `${s.name ?? ""} · ${fmtTime(s.at, i.lang)}${s.ua ? ` · ${es ? "Dispositivo" : "Device"}: ${s.ua.slice(0, 140)}` : ""}`
      : (es ? "Sin firmar" : "Not signed")]);
  }
  for (const [k, v] of rows) {
    need(40);
    doc.setFont("helvetica", "bold"); doc.text(pdfSafe(k), M, y); y += 12;
    doc.setFont("helvetica", "normal");
    for (const line of doc.splitTextToSize(pdfSafe(v), inner)) { need(12); doc.text(line, M, y); y += 12; }
    y += 6;
  }
  y += 8;
  doc.setFontSize(8.5); doc.setTextColor(110);
  const note = es
    ? "Firmado electrónicamente en OneHome. Cada firma quedó ligada a una cuenta verificada, con fecha y hora exactas. Si un solo carácter del texto cambiara, la huella SHA-256 no coincidiría. Mensajes de datos y firmas electrónicas: Ley 527 de 1999 (Colombia). La escritura pública, cuando aplique, se otorga ante notario."
    : "Signed electronically on OneHome. Each signature is bound to a verified account with its exact date and time. If a single character of the text changed, the SHA-256 fingerprint would not match. Electronic signatures: Colombian Law 527 of 1999. Where a public deed is required, it is executed before a notary.";
  for (const line of doc.splitTextToSize(pdfSafe(note), inner)) { need(11); doc.text(line, M, y); y += 11; }

  footer();
  return doc.output("blob");
}

/** Share sheet on a phone (WhatsApp, email, Print, Save to Files); a download everywhere else. */
export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title }); return "shared"; }
    catch (e) { if ((e as Error)?.name === "AbortError") return "cancelled"; }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Opens the PDF in the browser's own viewer, which has Print (and any Wi-Fi printer the phone knows). */
export function openPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

/** The signing invitation, pre-written for WhatsApp and email. */
export function inviteLinks(url: string, text: string, subject: string) {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
    email: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
  };
}

export const safeFilename = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "agreement";
