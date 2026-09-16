import { ScreenHeading } from "@oneworld/shell";
import { useState } from "react";
import {
  useI18n, useOneId, useAsync, supabase, W, IconPlatform,
} from "@oneworld/shell";

/**
 * /social/connect — THE RAISED CENTRE: connect and manage your social platforms.
 * ============================================================================================
 * Lee (9 Aug): "We certainly need a button to connect everything — it should be the middle
 * button… here's all my social media." OneSocial connects TRUE social media ONLY — Instagram,
 * Facebook, TikTok, X, YouTube, Twitch. Licences, reviews, BBB and the rest of the credibility
 * evidence belong to OneScore's Connect, not here; the two apps are siblings, not copies.
 *
 * Honest states, no theatre: a connected row shows the real handle from `social_connections`;
 * adding a handle writes a real self-reported row (marked unverified) and READS IT BACK;
 * account-verified connections (signing into the platform itself) come with the provider
 * rollout and say so plainly. Disconnect flips `is_active` and re-reads.
 */
const PLATFORMS: { key: string; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "facebook", label: "Facebook" },
  { key: "x", label: "X (Twitter)" },
  { key: "twitch", label: "Twitch" },
];

type Conn = { id: string; platform: string; username: string | null; is_verified: boolean | null; is_active: boolean | null };

export default function ConnectPlatformsScreen() {
  const { lang } = useI18n();
  const { userId } = useOneId();
  const [bump, setBump] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const conns = useAsync(async () => {
    const { data } = await supabase.from("social_connections")
      .select("id, platform, username, is_verified, is_active")
      .eq("user_id", userId!).eq("is_active", true);
    return (data ?? []) as Conn[];
  }, [userId, bump], !!userId);

  const connFor = (k: string) =>
    (conns ?? []).find(c => c.platform.toLowerCase() === k || (k === "x" && c.platform.toLowerCase() === "twitter"));

  const add = async (platform: string) => {
    if (!userId || busy || !handle.trim()) return;
    setBusy(true); setFailed(null);
    const clean = handle.trim().replace(/^@/, "");
    const { error } = await supabase.from("social_connections").insert({
      user_id: userId, platform, username: clean,
      auth_method: "handle", is_verified: false, is_active: true,
    });
    /* Never trust a write you have not read back. */
    const { data: check } = error ? { data: null } : await supabase.from("social_connections")
      .select("id").eq("user_id", userId).eq("platform", platform).eq("username", clean).limit(1);
    if (error || !check?.length) setFailed(platform);
    setBusy(false); setEditing(null); setHandle(""); setBump(b => b + 1);
  };

  const disconnect = async (c: Conn) => {
    if (busy) return;
    setBusy(true); setFailed(null);
    const { error } = await supabase.from("social_connections")
      .update({ is_active: false, disconnected_at: new Date().toISOString() }).eq("id", c.id);
    const { data: check } = error ? { data: null } : await supabase.from("social_connections")
      .select("is_active").eq("id", c.id).maybeSingle();
    if (error || check?.is_active !== false) setFailed(c.platform);
    setBusy(false); setBump(b => b + 1);
  };

  return (
    <div className="space-y-4">
      <div>
        <ScreenHeading className="mb-0">{W(lang, "Connect", "Conectar")}</ScreenHeading>
        <p className="mt-0.5 text-[13px] opacity-60">
          {W(lang,
            "All your social media, one place. Connect a platform and its posts join your feed and your public profile.",
            "Todas tus redes, un solo lugar. Conecta una plataforma y sus publicaciones llegan a tu feed y a tu perfil público.")}
        </p>
      </div>

      <div className="space-y-3">
        {PLATFORMS.map(p => {
          const c = connFor(p.key);
          return (
            <div key={p.key} className="card p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink/10 dark:border-white/15">
                  <IconPlatform name={p.key} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{p.label}</p>
                  {c ? (
                    <p className="truncate text-[12.5px] opacity-55">
                      @{c.username}{" "}
                      {c.is_verified
                        ? <span className="font-bold text-teal-deep dark:text-teal-light">{W(lang, "· verified", "· verificado")}</span>
                        : <span>{W(lang, "· self-reported", "· auto-declarado")}</span>}
                    </p>
                  ) : (
                    <p className="text-[12.5px] opacity-55">{W(lang, "Not connected", "No conectado")}</p>
                  )}
                </div>
                {c ? (
                  <button onClick={() => disconnect(c)} disabled={busy}
                    className="btn-ghost shrink-0 !px-3 !py-1.5 text-[12.5px]">
                    {W(lang, "Disconnect", "Desconectar")}
                  </button>
                ) : (
                  <button onClick={() => { setEditing(editing === p.key ? null : p.key); setHandle(""); }}
                    className="btn-brand shrink-0 !px-3.5 !py-1.5 text-[12.5px]" disabled={!userId}>
                    {W(lang, "Connect", "Conectar")}
                  </button>
                )}
              </div>

              {editing === p.key && !c && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={handle}
                    onChange={e => setHandle(e.target.value)}
                    placeholder={W(lang, "@yourhandle", "@tuusuario")}
                    className="w-full rounded-xl border border-ink/10 bg-transparent px-3 py-2 text-sm outline-none placeholder:opacity-50 dark:border-white/15"
                    autoFocus
                  />
                  <button onClick={() => add(p.key)} disabled={!handle.trim() || busy}
                    className="btn-brand shrink-0 !px-4 disabled:opacity-50">
                    {busy ? "…" : W(lang, "Add", "Agregar")}
                  </button>
                </div>
              )}
              {failed === p.key && (
                <p className="mt-2 text-[12px] font-bold text-red-500">
                  {W(lang, "That didn't save — try again.", "No se guardó — reintenta.")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="px-1 text-[12px] leading-snug opacity-50">
        {W(lang,
          "Self-reported handles show with that label until you verify by signing into the platform — account verification is rolling out.",
          "Los usuarios auto-declarados se muestran con esa etiqueta hasta que verifiques iniciando sesión en la plataforma — la verificación de cuenta está en camino.")}
      </p>
    </div>
  );
}
