import { useState } from "react";
import { supabase } from "@evt/integrations/supabase/client";
import { useAuth } from "@evt/hooks/useAuth";
import { ROLODEX_FIELDS, ROLODEX_NATIVE_KEYS, guessRolodexFieldFromHeader, type RolodexFieldKey } from "@evt/lib/rolodexSchema";
import { X, Upload, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
  onImported: () => void;
}

const EXTRA_NAME_FIELDS = ["first_name", "last_name"] as const;
type ExtraNameField = typeof EXTRA_NAME_FIELDS[number];
type ImportField = RolodexFieldKey | ExtraNameField | "ignore" | "custom";
const IDENTITY_FIELDS = new Set<ImportField>(["name", "first_name", "last_name", "email", "phone"]);
const NATIVE_KEYS = new Set<string>(ROLODEX_NATIVE_KEYS);

function normalizeHeader(header: string): string {
  return header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[:_*]+$/g, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

// Auto-detect delimiter: comma, semicolon (EU/Spain Excel), or tab
function detectDelimiter(text: string): string {
  // Sample the first ~5 non-empty lines (skip BOM)
  const sample = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim()).slice(0, 5).join("\n");
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    // Count delimiter chars outside of quotes (rough heuristic)
    let count = 0;
    let inQ = false;
    for (let i = 0; i < sample.length; i++) {
      const c = sample[i];
      if (c === '"') inQ = !inQ;
      else if (!inQ && c === d) count++;
    }
    if (count > bestCount) { bestCount = count; best = d; }
  }
  return best;
}

function parseCsv(text: string, delimiter?: string): string[][] {
  // Strip UTF-8 BOM if present (Excel exports often include it)
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const delim = delimiter || detectDelimiter(text);
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delim) { cur.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (cell !== "" || cur.length > 0) { cur.push(cell); rows.push(cur); cur = []; cell = ""; }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else cell += c;
    }
  }
  if (cell !== "" || cur.length > 0) { cur.push(cell); rows.push(cur); }
  return rows.filter((r) => r.some((v) => v.trim()));
}

function guessField(header: string): ImportField {
  const h = normalizeHeader(header);
  if (/^(first name|firstname|given name)$/.test(h)) return "first_name";
  if (/^(last name|lastname|surname|family name|apellido|apellidos)$/.test(h)) return "last_name";
  const canonical = guessRolodexFieldFromHeader(header);
  return canonical === "ignore" ? "custom" : canonical;
}

function isContactHeaderLike(header: string): boolean {
  const h = normalizeHeader(header);
  return IDENTITY_FIELDS.has(guessField(h)) || /^(url|linkedin|linkedin url|company|position|connected on|connected date)$/.test(h);
}

function findHeaderRowIndex(parsed: string[][]): number {
  const scanLimit = Math.min(parsed.length, 25);
  for (let i = 0; i < scanLimit; i++) {
    const row = parsed[i].map((cell) => cell.trim()).filter(Boolean);
    if (row.length >= 2 && row.filter(isContactHeaderLike).length >= 2) return i;
  }
  return 0;
}

function hasImportableIdentity(row: string[], mapping: ImportField[]): boolean {
  return mapping.some((m, i) => {
    if (!IDENTITY_FIELDS.has(m)) return false;
    return Boolean((row[i] || "").trim());
  });
}

export default function RolodexCsvImport({ onClose, onImported }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ImportField[]>([]);
  const [importing, setImporting] = useState(false);

  const onFile = async (f: File) => {
    try {
      if (/\.(xlsx|xls)$/i.test(f.name)) {
        toast.error("Native Excel files are not supported yet. Export the sheet as CSV or TSV first.");
        return;
      }
      const text = await f.text();
      if (!text.trim()) { toast.error("That file appears to be empty."); return; }
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        toast.error("CSV needs a header row + at least 1 data row. Tip: re-export as CSV (UTF-8) from Excel/Numbers/Google Sheets.");
        return;
      }
      const headerRowIndex = findHeaderRowIndex(parsed);
      const headerRow = parsed[headerRowIndex];
      const dataRows = parsed.slice(headerRowIndex + 1);
      if (headerRow.length < 2) {
        toast.error("Couldn't detect columns. Make sure your file is comma- or semicolon-separated.");
        return;
      }
      setHeaders(headerRow.map((h) => h.trim()));
      setRows(dataRows);
      setMapping(headerRow.map(guessField));
    } catch (err: any) {
      toast.error(`Couldn't read file: ${err?.message || "unknown error"}`);
    }
  };

  const doImport = async () => {
    if (!user?.id) return;
    setImporting(true);

    const records = rows.map((row) => {
      const rec: any = { host_id: user.id, source: "csv_import", custom_fields: {} };
      mapping.forEach((m, i) => {
        const val = (row[i] || "").trim();
        if (!val || m === "ignore") return;
        if (m === "first_name" || m === "last_name") {
          rec.custom_fields[m] = val;
        } else if (m === "custom") rec.custom_fields[headers[i]] = val;
        else if (NATIVE_KEYS.has(m)) rec[m] = val;
        else rec.custom_fields[m] = val;
      });
      if (!rec.name) rec.name = [rec.custom_fields.first_name, rec.custom_fields.last_name].filter(Boolean).join(" ").trim() || undefined;
      return rec;
    }).filter((r) => r.name || r.email || r.phone);

    if (records.length === 0) {
      toast.error("Map at least one column to name, email, or phone before importing.");
      setImporting(false);
      return;
    }

    const { error } = await supabase.from("host_rolodex" as any).insert(records);
    setImporting(false);
    if (error) { toast.error(`Import failed: ${error.message}`); return; }
    toast.success(`Imported ${records.length} contact${records.length === 1 ? "" : "s"}`);
    onImported();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Import contacts</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5">
          {rows.length === 0 ? (
            <label className="flex flex-col items-center justify-center gap-3 py-12 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Click to upload CSV or TSV</p>
                <p className="text-xs text-muted-foreground mt-1">Export Excel, Numbers, or Google Sheets as CSV first.</p>
              </div>
              <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                Map each column to a Rolodex field. Anything mapped to <span className="text-foreground font-semibold">Custom</span> gets stored in extra info (searchable, AI-readable).
              </p>
              <div className="space-y-2 mb-4">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/40">
                    <span className="text-sm text-foreground flex-1 truncate font-medium">{h}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <select value={mapping[i]} onChange={(e) => {
                      const next = [...mapping]; next[i] = e.target.value as ImportField; setMapping(next);
                    }} className="px-2 py-1.5 rounded-md bg-card border border-border text-sm text-foreground">
                      {EXTRA_NAME_FIELDS.map((f) => <option key={f} value={f}>{f.replace("_", " ")}</option>)}
                      {ROLODEX_FIELDS.filter((field) => field.key !== "photo_url").map((field) => (
                        <option key={field.key} value={field.key}>{field.label}</option>
                      ))}
                      <option value="custom">custom (extra info)</option>
                      <option value="ignore">ignore</option>
                    </select>
                  </div>
                ))}
              </div>
              {(() => {
                const importableCount = rows.filter((row) => hasImportableIdentity(row, mapping)).length;
                return (
                  <>
                    <p className="text-xs text-muted-foreground mb-4">
                      {importableCount > 0
                        ? `${importableCount} row${importableCount === 1 ? "" : "s"} ready to import`
                        : "Map a column to name, email, or phone to import contacts."}
                    </p>
                    <button onClick={doImport} disabled={importing || importableCount === 0}
                      className="w-full px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                      {importing ? "Importing…" : <><Check className="w-4 h-4" /> Import {importableCount} contacts</>}
                    </button>
                  </>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
