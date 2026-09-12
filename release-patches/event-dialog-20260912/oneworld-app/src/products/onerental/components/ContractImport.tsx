import { useMemo, useRef, useState } from "react";

type Section = "rentals" | "sales";
type Route = "upload" | "paste" | "url";
type Target = "terms" | "description" | "both";
type Row = { key: string; value: string };
type Evidence = { key: string; quote: string };
type Blocked = { label: string; found?: string; reason: string };
type Unmapped = { label: string; value: string };

export type ContractImportApply = {
  target: Target;
  fields: Record<string, string>;
  terms: Record<string, string>;
  description: string;
  unmapped: Unmapped[];
  docKind: string;
};

type ExtractResult = {
  doc_kind: string;
  description: string;
  fields: Row[];
  terms: Row[];
  evidence: Evidence[];
  blocked: Blocked[];
  unmapped: Unmapped[];
};

type Props = {
  section: Section;
  onApply: (payload: ContractImportApply) => void;
  onClose: () => void;
  invoke: (fn: string, body: unknown) => Promise<unknown>;
};

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.md";
const MAX_BYTES = 12 * 1024 * 1024;
const KINDS: Record<string, string> = {
  residential_lease: "a residential lease",
  commercial_lease: "a commercial lease",
  tourist_lodging_agreement: "a short-stay agreement",
  sale_promise: "a promise of sale",
  listing_copy: "listing copy",
  other: "a document we could not classify",
};

function pretty(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.onload = () => resolve(String(reader.result || "").split(",").pop() || "");
    reader.readAsDataURL(file);
  });
}

export default function ContractImport({ section, onApply, onClose, invoke }: Props) {
  const [route, setRoute] = useState<Route>("upload");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [target, setTarget] = useState<Target>("both");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [keepDescription, setKeepDescription] = useState(true);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const evidence = useMemo(() => new Map((result?.evidence || []).map(row => [row.key, row.quote])), [result]);

  async function run(source: unknown) {
    setBusy(true); setError(null);
    try {
      const value = await invoke("extract-lease", { section, source }) as ExtractResult;
      if (!value || !Array.isArray(value.fields) || !Array.isArray(value.terms)) throw new Error("The document could not be read.");
      setResult(value); setOff(new Set()); setKeepDescription(Boolean(value.description));
      setTarget(value.doc_kind === "listing_copy" ? "description" : "both");
    } catch (cause: any) {
      setError(cause?.message || "The document could not be read.");
    } finally { setBusy(false); }
  }

  async function choose(file: File | null) {
    if (!file) return;
    if (file.size > MAX_BYTES) { setError("That file is larger than 12 MB. Try a smaller scan, or paste the text."); return; }
    await run({ kind: "upload", mime: file.type || "application/pdf", data: await fileToBase64(file) });
  }

  function toggle(key: string) {
    setOff(current => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; });
  }

  function apply() {
    if (!result) return;
    const pick = (rows: Row[]) => Object.fromEntries(rows.filter(row => !off.has(row.key)).map(row => [row.key, row.value]));
    onApply({
      target,
      fields: target === "terms" ? {} : pick(result.fields),
      terms: target === "description" ? {} : pick(result.terms),
      description: target !== "terms" && keepDescription ? result.description : "",
      unmapped: result.unmapped || [],
      docKind: result.doc_kind,
    });
  }

  const panel = "fixed inset-0 z-[120] overflow-y-auto bg-black/45 p-3 backdrop-blur-sm";
  const card = "mx-auto my-4 max-w-2xl rounded-[28px] border border-white/70 bg-white/95 p-5 text-ink shadow-2xl dark:border-white/15 dark:bg-[#161616] dark:text-white";
  const option = "ow-tap min-h-12 rounded-2xl border border-ink/15 px-4 py-2 text-sm font-black dark:border-white/20";

  if (!result) return <div className={panel} role="dialog" aria-modal="true" aria-label="Import from a document"><div className={card}>
    <h2 className="text-xl font-black">Import from a document</h2>
    <p className="mt-2 text-sm leading-relaxed opacity-70">Upload, paste or link a contract. OneHome shows every suggestion and its source. Nothing is applied until you approve it.</p>
    <div className="mt-4 grid grid-cols-3 gap-2" role="tablist">{(["upload","paste","url"] as Route[]).map(value =>
      <button type="button" key={value} className={`${option} ${route === value ? "border-brand bg-brand/10 text-brand" : ""}`} aria-selected={route === value} onClick={() => setRoute(value)}>{value === "upload" ? "Upload" : value === "paste" ? "Paste" : "Link"}</button>)}</div>
    {route === "upload" && <div className="mt-4 rounded-3xl border border-dashed border-brand/35 bg-brand/[0.05] p-5 text-center"><input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={event => void choose(event.target.files?.[0] || null)} /><button type="button" className="btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>Choose a file</button><p className="mt-2 text-xs opacity-60">PDF, photo or text, up to 12 MB.</p></div>}
    {route === "paste" && <div className="mt-4"><textarea className="input min-h-40 w-full" value={text} onChange={event => setText(event.target.value)} placeholder="Paste the contract text here." /><button type="button" className="btn-primary mt-3 w-full" disabled={busy || !text.trim()} onClick={() => void run({ kind: "paste", text })}>Read this text</button></div>}
    {route === "url" && <div className="mt-4"><input className="input w-full" type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" /><button type="button" className="btn-primary mt-3 w-full" disabled={busy || !url.trim()} onClick={() => void run({ kind: "url", url })}>Read this link</button></div>}
    {busy && <p className="mt-3 text-sm font-bold text-brand">Reading the document…</p>}{error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}
    <button type="button" className="btn-ghost mt-4 w-full" onClick={onClose} disabled={busy}>Cancel</button>
  </div></div>;

  const propertyRows = target === "terms" ? [] : result.fields;
  const termRows = target === "description" ? [] : result.terms;
  return <div className={panel} role="dialog" aria-modal="true" aria-label="Review what we found"><div className={card}>
    <h2 className="text-xl font-black">This looks like {KINDS[result.doc_kind] || "a document"}.</h2>
    <p className="mt-2 text-sm opacity-70">Choose what to fill. Untick anything you do not want.</p>
    <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup">{([['terms','Fill my terms'],['description','Fill description'],['both','Both']] as [Target,string][]).map(([value,label]) => <button type="button" role="radio" aria-checked={target === value} key={value} className={`${option} ${target === value ? "border-brand bg-brand/10 text-brand" : ""}`} onClick={() => setTarget(value)}>{label}</button>)}</div>
    {!!result.blocked?.length && <section className="mt-5 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4"><h3 className="font-black">Not carried across</h3>{result.blocked.map((row,index) => <div className="mt-3" key={`${row.label}-${index}`}><strong className="text-sm">{pretty(row.label)}</strong>{row.found && <p className="text-sm italic">“{row.found}”</p>}<p className="text-xs leading-relaxed opacity-70">{row.reason}</p></div>)}</section>}
    {target !== "terms" && result.description && <section className="mt-5"><label className="flex gap-3 font-bold"><input type="checkbox" checked={keepDescription} onChange={() => setKeepDescription(value => !value)} />Use this description</label><p className="mt-2 rounded-2xl bg-black/[0.04] p-3 text-sm dark:bg-white/[0.06]">{result.description}</p></section>}
    {[{title:"Terms — for the agreement",rows:termRows},{title:"Property — for the listing",rows:propertyRows}].map(group => group.rows.length ? <section className="mt-5" key={group.title}><h3 className="font-black">{group.title}</h3>{group.rows.map(row => <label key={row.key} className={`mt-2 block rounded-2xl border p-3 ${off.has(row.key) ? "opacity-45" : "border-brand/20"}`}><span className="flex gap-3"><input type="checkbox" checked={!off.has(row.key)} onChange={() => toggle(row.key)} /><span><strong className="block text-sm">{pretty(row.key)}</strong><span className="text-sm">{row.value}</span></span></span>{evidence.get(row.key) && <span className="mt-2 block border-l-2 border-brand/30 pl-3 text-xs italic opacity-60">“{evidence.get(row.key)}”</span>}</label>)}</section> : null)}
    {!!result.unmapped?.length && <section className="mt-5 rounded-3xl bg-black/[0.04] p-4 dark:bg-white/[0.06]"><h3 className="font-black">Other things it says</h3><p className="text-xs opacity-60">Kept as notes so nothing is lost.</p>{result.unmapped.map((row,index) => <p className="mt-2 text-sm" key={`${row.label}-${index}`}><strong>{row.label}:</strong> {row.value}</p>)}</section>}
    <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn-primary" onClick={apply}>Apply what is ticked</button></div>
  </div></div>;
}
