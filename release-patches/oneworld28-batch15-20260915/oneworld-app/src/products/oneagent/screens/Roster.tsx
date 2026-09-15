import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, useOneId, ScreenHeading } from "@oneworld/shell";
import { useT, INPUT, LABEL } from "../lib/dict";
import {
  addRosterMember, bulkAddRoster, fetchRoster, parseRosterCsv,
  type CsvRow, type RosterRow,
} from "../lib/data";

/**
 * ROSTER — the represented people, and the channel strategy in code.
 * ============================================================================================
 * One agent with a 40-person roster = 40 onboarded members, so BULK IMPORT is a first-class
 * citizen: paste or upload a CSV (name, email, category), preview client-side, insert in one
 * write. Manual entry for 40 people means no agent finishes — the paste box is the promise.
 *
 * Ladder chips (the partner ladder, Lee 9 Aug 2026): invited (grey) → connected (soft teal) →
 * partnered (solid TEAL — the family's state colour; a standing partnership is the held-true
 * state) · ended (grey). "Resend invite" is honestly just a timestamp touch until the mail
 * machinery exists.
 */

export function PartnerChip({ status }: { status: string }) {
  const { t } = useT();
  if (status === "partnered") {
    return <span className="rounded-full bg-teal px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">{t("psPartnered")}</span>;
  }
  if (status === "connected") {
    return <span className="rounded-full bg-teal/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-teal-deep">{t("psConnected")}</span>;
  }
  return (
    <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide opacity-60 dark:bg-white/10">
      {status === "ended" ? t("psEnded") : t("psInvited")}
    </span>
  );
}

export default function Roster() {
  const { t } = useT();
  const { userId } = useOneId();
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /* Add-one form */
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [addErr, setAddErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* Bulk import */
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<{ rows: CsvRow[]; skipped: number } | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (uid: string) => {
    const r = await fetchRoster(uid);
    setRoster(r.rows); setPending(r.pending); setLoaded(true);
  };
  useEffect(() => { if (userId) load(userId); else setLoaded(true); }, [userId]);

  const addOne = async () => {
    if (!userId) return;
    if (!name.trim() || !email.trim()) { setAddErr(t("needNameEmail")); return; }
    setAddErr(null); setBusy(true);
    const res = await addRosterMember(userId, {
      full_name: name.trim(), email: email.trim(), category: category.trim(), notes: notes.trim(),
    });
    setBusy(false);
    if (res.ok) {
      setName(""); setEmail(""); setCategory(""); setNotes(""); setShowAdd(false);
      await load(userId);
    } else setAddErr(t("addFailed"));
  };

  const onCsvChange = (text: string) => {
    setCsvText(text);
    setImportMsg(null);
    setPreview(text.trim() ? parseRosterCsv(text) : null);
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onCsvChange(String(reader.result ?? ""));
    reader.readAsText(f);
  };

  const doImport = async () => {
    if (!userId || !preview || preview.rows.length === 0) return;
    setBusy(true);
    const res = await bulkAddRoster(userId, preview.rows);
    setBusy(false);
    if (res.ok) {
      setImportMsg(`${preview.rows.length} ${t("importedOk")}`);
      setCsvText(""); setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      await load(userId);
    } else setImportMsg(t("importFailed"));
  };

  if (!userId) {
    return <p className="text-sm opacity-60">{t("signInFirst")}</p>;
  }

  return (
    <div className="space-y-3">
      {/* Was a bare `<h1>` in its own flex row, which put the title on one line and VAIA on
          another. `ScreenHeading` puts the title, the Add control and the pill on ONE row and
          claims the pill so the shell stands its own row down. */}
      <ScreenHeading right={
        <button onClick={() => setShowAdd(v => !v)}
                className="btn-primary ow-tap !px-4 !py-2 text-[13px]">{t("addMember")}</button>
      }>{t("rosterTitle")}</ScreenHeading>

      {pending && <p className="text-[13px] opacity-50">{t("pendingNote")}</p>}
      {!loaded && <p className="text-[13px] opacity-50">{t("loading")}</p>}

      {/* Add one — small form; every new member starts on the ladder's first rung, 'invited'. */}
      {showAdd && (
        <div className="card !rounded-3xl space-y-3">
          <div>
            <label className={LABEL}>{t("fName")}</label>
            <input className={INPUT} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>{t("fEmail")}</label>
            <input className={INPUT} type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>{t("fCategory")}</label>
            <input className={INPUT} value={category} onChange={e => setCategory(e.target.value)} placeholder={t("catPh")} />
          </div>
          <div>
            <label className={LABEL}>{t("fNotes")}</label>
            <textarea className={INPUT} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          {addErr && <p className="text-[13px] font-semibold text-red-600">{addErr}</p>}
          <button onClick={addOne} disabled={busy} className="btn-primary ow-tap w-full text-sm">
            {busy ? t("loading") : t("saveMember")}
          </button>
        </div>
      )}

      {/* The list */}
      {loaded && roster.length === 0 && !showAdd && (
        <div className="card !rounded-3xl">
          <h2 className="text-base font-extrabold">{t("emptyRosterTitle")}</h2>
          <p className="mt-1 text-[13.5px] opacity-60">{t("emptyRosterBody")}</p>
        </div>
      )}

      {roster.map(m => (
        <Link key={m.id} to={`/agent/roster/${m.id}`} className="card ow-tap flex items-center gap-3 !rounded-2xl">
          <Avatar name={m.full_name} src={null} size={40} textSize="text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-bold leading-snug">{m.full_name}</p>
            {m.category && <p className="truncate text-[13px] opacity-60">{m.category}</p>}
          </div>
          <PartnerChip status={m.partner_status} />
        </Link>
      ))}

      {/* ── Bulk import — the "bring your roster" promise ── */}
      <div className="card !rounded-3xl space-y-3">
        <div>
          <h2 className="text-base font-extrabold">{t("bulkTitle")}</h2>
          <p className="mt-1 text-[13px] leading-snug opacity-60">{t("bulkHint")}</p>
        </div>
        <textarea className={`${INPUT} font-mono text-[13px]`} rows={4} value={csvText}
                  onChange={e => onCsvChange(e.target.value)} placeholder={t("csvPh")} />
        <div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                 onChange={e => onFile(e.target.files?.[0] ?? null)} />
          <button onClick={() => fileRef.current?.click()}
                  className="ow-tap inline-flex items-center justify-center rounded-xl border border-ink/10 px-4 py-2 text-[13px] font-semibold dark:border-white/15">
            {t("uploadCsv")}
          </button>
        </div>

        {preview && (
          <div className="rounded-xl border border-ink/10 px-3 py-2.5 dark:border-white/15">
            <p className="text-[13px] font-bold">
              {preview.rows.length} {t("previewReady")}
              {preview.skipped > 0 && (
                <span className="font-normal opacity-60"> · {preview.skipped} {t("skippedRows")}</span>
              )}
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {preview.rows.slice(0, 40).map((r, i) => (
                <li key={i} className="truncate text-[13px] opacity-70">
                  {r.full_name} · {r.email}{r.category ? ` · ${r.category}` : ""}
                </li>
              ))}
            </ul>
            <button onClick={doImport} disabled={busy || preview.rows.length === 0}
                    className="btn-primary ow-tap mt-3 w-full !py-2.5 text-[13px]">
              {busy ? t("loading") : `${t("importNow")} (${preview.rows.length})`}
            </button>
          </div>
        )}

        {importMsg && <p className="text-[13px] font-semibold text-teal-deep">{importMsg}</p>}
      </div>
    </div>
  );
}
