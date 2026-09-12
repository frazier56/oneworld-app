import { useState, useEffect, useCallback } from "react";
import { supabase } from "@evt/integrations/supabase/client";
import { Button } from "@evt/components/ui/button";
import { Input } from "@evt/components/ui/input";
import { Label } from "@evt/components/ui/label";
import { Textarea } from "@evt/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@evt/components/ui/dialog";
import { toast } from "sonner";
import { Utensils, Wine, Plus, Trash2, Pencil, CheckCircle2, Clock } from "lucide-react";
import { useLanguage, useMicro } from "@evt/i18n/LanguageContext";

interface FdItem {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  item_type: "food" | "drink";
  quantity_per_ticket: number;
  max_total: number | null;
  created_at: string;
}

interface RedemptionStat {
  item_id: string;
  total: number;
  redeemed: number;
}

interface Props {
  eventId: string;
}

const empty = () => ({
  name: "",
  description: "",
  item_type: "food" as "food" | "drink",
  quantity_per_ticket: 1,
  max_total: "" as string | number,
});

export default function EventFoodDrinkPanel({ eventId }: Props) {
  const { lang } = useLanguage();
  const [items, setItems] = useState<FdItem[]>([]);
  const [stats, setStats] = useState<Record<string, RedemptionStat>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FdItem | null>(null);
  const [form, setForm] = useState(empty());

  const isEs = lang === "es";
  /* v15: the local en/es shim now routes through the seven-language micro table —
     same t(en, es) call signature, zero call-site churn. */
  const t = useMicro();

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: it }, { data: red }] = await Promise.all([
      supabase
        .from("event_food_drink_items")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase
        .from("event_food_drink_redemptions")
        .select("item_id, redeemed_at")
        .in(
          "item_id",
          (
            await supabase
              .from("event_food_drink_items")
              .select("id")
              .eq("event_id", eventId)
          ).data?.map((r: any) => r.id) || ["00000000-0000-0000-0000-000000000000"],
        ),
    ]);
    setItems((it || []) as any);
    const map: Record<string, RedemptionStat> = {};
    (red || []).forEach((r: any) => {
      const s = map[r.item_id] || { item_id: r.item_id, total: 0, redeemed: 0 };
      s.total += 1;
      if (r.redeemed_at) s.redeemed += 1;
      map[r.item_id] = s;
    });
    setStats(map);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`fd-items-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_food_drink_items", filter: `event_id=eq.${eventId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_food_drink_redemptions" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [eventId, load]);

  const openCreate = () => {
    setEditing(null);
    setForm(empty());
    setOpen(true);
  };

  const openEdit = (it: FdItem) => {
    setEditing(it);
    setForm({
      name: it.name,
      description: it.description || "",
      item_type: it.item_type,
      quantity_per_ticket: it.quantity_per_ticket,
      max_total: it.max_total ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(t("Name is required", "El nombre es obligatorio"));
      return;
    }
    const payload = {
      event_id: eventId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      item_type: form.item_type,
      quantity_per_ticket: Math.max(1, Number(form.quantity_per_ticket) || 1),
      max_total: form.max_total === "" ? null : Number(form.max_total),
    };
    if (editing) {
      const { error } = await supabase.from("event_food_drink_items").update(payload).eq("id", editing.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("Item updated", "Artículo actualizado"));
    } else {
      const { error } = await supabase.from("event_food_drink_items").insert(payload);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("Item added", "Artículo agregado"));
    }
    setOpen(false);
  };

  const remove = async (id: string) => {
    if (!confirm(t("Delete this item? This cannot be undone.", "¿Eliminar este artículo? Esta acción no se puede deshacer."))) return;
    const { error } = await supabase.from("event_food_drink_items").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("Deleted", "Eliminado"));
  };

  const total = items.reduce((acc, it) => acc + (stats[it.id]?.total || 0), 0);
  const totalRedeemed = items.reduce((acc, it) => acc + (stats[it.id]?.redeemed || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-foreground font-bold text-lg flex items-center gap-2">
            <Utensils className="w-4 h-4 text-primary" />
            {t("Food & Drink Tickets", "Tickets de Comida y Bebida")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t(
              "Add items attendees can redeem on event day. Each item gets its own QR code.",
              "Agrega artículos que los asistentes pueden canjear el día del evento. Cada artículo obtiene su propio código QR.",
            )}
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1">
          <Plus className="w-3.5 h-3.5" /> {t("Add Item", "Agregar")}
        </Button>
      </div>

      {/* Summary */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-border/40 bg-card/50 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("Items", "Artículos")}</p>
            <p className="text-lg font-bold text-foreground">{items.length}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card/50 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("Issued", "Emitidos")}</p>
            <p className="text-lg font-bold text-foreground">{total}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
            <p className="text-[10px] text-emerald-400 uppercase tracking-wide">{t("Redeemed", "Canjeados")}</p>
            <p className="text-lg font-bold text-emerald-400">{totalRedeemed}</p>
          </div>
        </div>
      )}

      {/* Items list */}
      {loading ? (
        <div className="text-center text-xs text-muted-foreground py-8">{t("Loading…", "Cargando…")}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 p-8 text-center">
          <Utensils className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            {t("No food or drink items yet.", "Aún no hay artículos de comida o bebida.")}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {t(
              "Add items like \"Beer\", \"Welcome cocktail\", or \"Lunch box\" — each becomes a redeemable QR ticket.",
              'Agrega artículos como "Cerveza", "Cóctel de bienvenida" o "Almuerzo" — cada uno se convierte en un ticket QR canjeable.',
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const s = stats[it.id] || { total: 0, redeemed: 0 };
            const pct = s.total > 0 ? Math.round((s.redeemed / s.total) * 100) : 0;
            return (
              <div key={it.id} className="rounded-xl border border-border/40 bg-card/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        it.item_type === "drink"
                          ? "bg-blue-500/15 text-blue-400"
                          : "bg-amber-500/15 text-amber-400"
                      }`}
                    >
                      {it.item_type === "drink" ? <Wine className="w-4 h-4" /> : <Utensils className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{it.name}</p>
                      {it.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{it.description}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                        {it.quantity_per_ticket}× {t("per ticket", "por entrada")}
                        {it.max_total ? ` · ${t("max", "máx")} ${it.max_total}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(it)}
                      className="p-1.5 rounded-md hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => remove(it.id)}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                      aria-label="delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {s.total > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        {s.redeemed} / {s.total} {t("redeemed", "canjeados")}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {s.total - s.redeemed} {t("pending", "pendientes")}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      {/* v20 BY (Lee): per-attendee tracking + top-ups — "I see you have the tickets…
          let me give him another ticket." Counts live off the same redemption rows the
          scanner burns; +1 inserts one more voucher for that attendee & item. */}
      {items.length > 0 && <FdAllocations eventId={eventId} items={items} t={t} />}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t("Edit Item", "Editar Artículo")
                : t("Add Food or Drink Item", "Agregar Comida o Bebida")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2">
              {(["food", "drink"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, item_type: type }))}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border transition-all ${
                    form.item_type === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/40 text-muted-foreground hover:border-border"
                  }`}
                >
                  {type === "food" ? <Utensils className="w-3.5 h-3.5" /> : <Wine className="w-3.5 h-3.5" />}
                  <span className="text-xs font-semibold capitalize">
                    {type === "food" ? t("Food", "Comida") : t("Drink", "Bebida")}
                  </span>
                </button>
              ))}
            </div>

            <div>
              <Label className="text-xs">{t("Item name", "Nombre del artículo")} *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={form.item_type === "drink" ? t("e.g. Welcome cocktail", "p.ej. Cóctel de bienvenida") : t("e.g. Lunch box", "p.ej. Caja de almuerzo")}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">{t("Description (optional)", "Descripción (opcional)")}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t("Notes for attendees and bar staff", "Notas para asistentes y personal")}
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t("Per ticket", "Por entrada")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.quantity_per_ticket}
                  onChange={(e) => setForm((f) => ({ ...f, quantity_per_ticket: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{t("Max total (optional)", "Máx total (opcional)")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.max_total}
                  onChange={(e) => setForm((f) => ({ ...f, max_total: e.target.value }))}
                  placeholder={t("Unlimited", "Ilimitado")}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("Cancel", "Cancelar")}
            </Button>
            <Button onClick={save}>
              {editing ? t("Save", "Guardar") : t("Add Item", "Agregar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FdAllocations({ eventId, items, t }: { eventId: string; items: FdItem[]; t: (en: string, es?: string) => string }) {
  const [rows, setRows] = useState<{ regId: string; name: string; counts: Record<string, { total: number; redeemed: number }> }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const loadAlloc = useCallback(async () => {
    const { data: regs } = await supabase
      .from("event_registrations")
      .select("id, user_id, guest_name, status")
      .eq("event_id", eventId)
      .neq("status", "cancelled");
    const regList: any[] = regs || [];
    if (regList.length === 0) { setRows([]); return; }
    const uids = regList.map((r) => r.user_id).filter(Boolean);
    const { data: profs } = uids.length
      ? await supabase.from("profiles").select("id, full_name").in("id", uids)
      : { data: [] as any[] };
    const nameOf = new Map((profs || []).map((p: any) => [p.id, p.full_name]));
    const { data: reds } = await supabase
      .from("event_food_drink_redemptions")
      .select("registration_id, item_id, redeemed_at")
      .in("registration_id", regList.map((r) => r.id));
    const byReg: Record<string, Record<string, { total: number; redeemed: number }>> = {};
    (reds || []).forEach((r: any) => {
      const reg = (byReg[r.registration_id] ||= {});
      const c = (reg[r.item_id] ||= { total: 0, redeemed: 0 });
      c.total += 1;
      if (r.redeemed_at) c.redeemed += 1;
    });
    setRows(regList.map((r) => ({
      regId: r.id,
      name: nameOf.get(r.user_id) || r.guest_name || "Attendee",
      counts: byReg[r.id] || {},
    })));
  }, [eventId]);

  useEffect(() => { void loadAlloc(); }, [loadAlloc, items.length]);

  const grant = async (regId: string, itemId: string) => {
    setBusy(`${regId}:${itemId}`);
    const { error } = await supabase
      .from("event_food_drink_redemptions")
      .insert({ registration_id: regId, item_id: itemId });
    setBusy(null);
    if (error) { toast.error(t("Could not add the voucher", "No se pudo agregar el ticket")); return; }
    toast.success(t("Voucher added", "Ticket agregado"));
    void loadAlloc();
  };

  if (rows.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border/40 bg-card/50 p-4">
      <h4 className="text-sm font-bold text-foreground mb-1">{t("Attendee allocations", "Asignaciones por asistente")}</h4>
      <p className="text-[11px] text-muted-foreground mb-3">
        {t("Live usage per attendee — tap +1 to give someone an extra voucher.", "Uso en vivo por asistente — toca +1 para dar un ticket extra.")}
      </p>
      <div className="divide-y divide-border/40">
        {rows.map((row) => (
          <div key={row.regId} className="py-2.5">
            <p className="text-sm font-semibold text-foreground mb-1.5">{row.name}</p>
            <div className="flex flex-wrap gap-2">
              {items.map((it) => {
                const c = row.counts[it.id] || { total: 0, redeemed: 0 };
                return (
                  <span key={it.id} className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/50 pl-2.5 pr-1 py-1 text-xs">
                    {it.item_type === "drink" ? <Wine className="w-3 h-3 text-blue-400 shrink-0" /> : <Utensils className="w-3 h-3 text-amber-400 shrink-0" />}
                    <span className="text-foreground">{it.name}</span>
                    <span className="text-muted-foreground tabular-nums">{c.redeemed}/{c.total}</span>
                    <button
                      onClick={() => grant(row.regId, it.id)}
                      disabled={busy === `${row.regId}:${it.id}`}
                      className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-primary font-bold hover:bg-primary/25 disabled:opacity-50"
                      title={t("Give one more", "Dar uno más")}
                    >+</button>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
