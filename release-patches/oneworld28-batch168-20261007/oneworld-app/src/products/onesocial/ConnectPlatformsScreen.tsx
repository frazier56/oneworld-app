import { useEffect, useState } from "react";
import {
  ScreenHeading, useI18n, useOneId, useAsync, supabase, W,
  PlatformMark, ConnectConfidence,
  canTapToConnect, anyTapToConnect, connectStartUrl, stepUpUrl, readConnectReturn, judgeClaimedAccount, nextStepFor,
} from "@oneworld/shell";
import type { ClaimedAccount, MatchVerdict } from "@oneworld/shell";

/**
 * /social/connect — ONE TAP, THE PLATFORM'S OWN "WAS THIS YOU?", DONE.
 * ============================================================================================
 * Lee, 8 October 2026: *"I should be able to go to OneSocial, my profile, click connect, and
 * then it works. Open up your Instagram and click yes, One World is trying to access your
 * account. Boom, it comes back. Boom, it's connected. And five seconds later all the posts
 * start showing up."* And the rule over all of it: **"We're not talking about a code anywhere."**
 *
 * ── WHAT THIS SCREEN WAS, AND WHY IT CHANGED ───────────────────────────────────────────────
 * It asked the member to TYPE THEIR HANDLE and then wrote it down as "self-reported". That is
 * not a connection — it is a label the member chose for themselves, and anyone can type anyone
 * else's handle into it. It stays, because until a provider is switched on it is the only
 * honest thing on offer, but it is now the fallback and it says what it is.
 *
 * ── HIDDEN, NOT DISABLED ───────────────────────────────────────────────────────────────────
 * `canTapToConnect` derives whether the one-tap path really exists for a platform. When it does
 * not, the tap button is not drawn at all and the member sees the fallback. No greyed control
 * advertising something that will refuse them — the rule the shell already follows for Apple
 * sign-in, Places autocomplete and the writing assist.
 *
 * ── THE SECOND QUESTION, ALWAYS ASKED ──────────────────────────────────────────────────────
 * Coming back from the platform does NOT connect the account. The approval proves somebody
 * controls it; `judgeClaimedAccount` asks whether it looks like this person — name, email,
 * phone, location — and `ConnectConfidence` shows them the answer. Lee: *"it could be a stolen
 * account, right?"*
 */

const PLATFORMS: { key: string; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "facebook", label: "Facebook" },
  { key: "x", label: "X" },
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

  /* What came back from the platform, if we are returning from one. */
  const [claimed, setClaimed] = useState<ClaimedAccount | null>(null);
  const [verdict, setVerdict] = useState<MatchVerdict | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);
  /* Proof that they came back through a FORCED fresh sign-in at the platform. Null until they
     do. The server re-checks it; this copy only decides whether the button is alive. */
  const [stepUp, setStepUp] = useState<string | null>(null);

  const conns = useAsync(async () => {
    const { data } = await supabase.from("social_connections")
      .select("id, platform, username, is_verified, is_active")
      .eq("user_id", userId!).eq("is_active", true);
    return (data ?? []) as Conn[];
  }, [userId, bump], !!userId);

  /* Named columns only — `select('*')` on profiles throws 42501. */
  const me = useAsync(async () => {
    const { data } = await supabase.from("profiles")
      .select("full_name, email, phone, location").eq("id", userId!).maybeSingle();
    return (data ?? null) as { full_name: string | null; email: string | null; phone: string | null; location: string | null } | null;
  }, [userId], !!userId);

  /* ── Coming back from the platform ──────────────────────────────────────────────────────
     The address carries a one-time reference, never a token. We exchange it server-side for
     what the account says about itself, then score it. Nothing is written until the member
     presses Connect it on the card below. */
  useEffect(() => {
    const back = readConnectReturn(window.location.search);
    if (!back || !userId) return;
    /* Clear the address immediately: a one-time reference must not survive in history, and a
       refresh must not replay it. */
    window.history.replaceState({}, "", window.location.pathname);
    if (back.error || !back.ref) { setReturnError(back.platform); return; }
    setStepUp(back.stepUp ?? null);
    let live = true;
    (async () => {
      const { data, error } = await supabase.functions.invoke("social-connect-finish", {
        body: { ref: back.ref, platform: back.platform, user_id: userId },
      });
      if (!live) return;
      const acct = (data as { account?: ClaimedAccount } | null)?.account;
      if (error || !acct) { setReturnError(back.platform); return; }
      setClaimed(acct);
    })();
    return () => { live = false; };
  }, [userId]);

  /* Scored only once both halves are in hand, and re-scored if the profile finishes loading
     after the account does. */
  useEffect(() => {
    if (!claimed) { setVerdict(null); return; }
    setVerdict(judgeClaimedAccount({
      name: me?.full_name, email: me?.email, phone: me?.phone, location: me?.location,
    }, claimed));
  }, [claimed, me?.full_name, me?.email, me?.phone, me?.location]);

  const connFor = (k: string) =>
    (conns ?? []).find(c => c.platform.toLowerCase() === k || (k === "x" && c.platform.toLowerCase() === "twitter"));

  const tap = (key: string) => {
    const url = userId && connectStartUrl(key, userId, window.location.pathname);
    if (url) window.location.assign(url);
  };

  /* The member pressed Connect it on the confidence card. */
  const acceptClaimed = async () => {
    if (!userId || !claimed || busy) return;
    setBusy(true); setFailed(null);
    const platform = claimed.platform.toLowerCase();
    const username = (claimed.username ?? "").replace(/^@/, "");
    /* ⚠️ A `check` verdict may NEVER be written from the client without the step-up token, and
       the finalizer must refuse it server-side as well — this is the courtesy copy of a rule
       that has to live where a browser cannot reach it. */
    if (verdict && nextStepFor(verdict) === "challenge" && !stepUp) { setBusy(false); return; }

    const { error } = await supabase.from("social_connections").insert({
      user_id: userId, platform, username,
      auth_method: stepUp ? "oauth_step_up" : "oauth", is_verified: true, is_active: true,
    });
    /* Never trust a write you have not read back. */
    const { data: check } = error ? { data: null } : await supabase.from("social_connections")
      .select("id").eq("user_id", userId).eq("platform", platform).eq("is_active", true).limit(1);
    if (error || !check?.length) setFailed(platform);
    setBusy(false); setClaimed(null); setVerdict(null); setStepUp(null); setBump(b => b + 1);
  };

  const add = async (platform: string) => {
    if (!userId || busy || !handle.trim()) return;
    setBusy(true); setFailed(null);
    const clean = handle.trim().replace(/^@/, "");
    const { error } = await supabase.from("social_connections").insert({
      user_id: userId, platform, username: clean,
      auth_method: "handle", is_verified: false, is_active: true,
    });
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
        {/* ⚠️ The subtitle must not promise a button that is not on the screen. Caught by looking
            at it with no provider switched on: it said "tap connect, say yes on the platform" above
            six rows whose only control was Add handle. */}
        <p className="mt-0.5 text-[13px] opacity-60">
          {anyTapToConnect()
            ? W(lang,
              "All your social media, one place. Tap connect, say yes on the platform, and your posts arrive on your profile.",
              "Todas tus redes, un solo lugar. Toca conectar, di que sí en la plataforma y tus publicaciones llegan a tu perfil.")
            : W(lang,
              "All your social media, one place. Add your name on each platform now; one-tap connect, which brings your posts across, is switching on platform by platform.",
              "Todas tus redes, un solo lugar. Agrega tu usuario en cada plataforma ahora; la conexión de un toque, que trae tus publicaciones, se activa plataforma por plataforma.")}
        </p>
      </div>

      {/* Back from the platform, and the account is being checked against them. */}
      {verdict && claimed && (
        <ConnectConfidence
          platform={claimed.platform}
          handle={claimed.username ? `@${claimed.username.replace(/^@/, "")}` : null}
          verdict={verdict}
          busy={busy}
          challenge={nextStepFor(verdict) === "challenge" ? {
            passed: !!stepUp,
            token: stepUp,
            node: <FreshSignIn lang={lang} platform={claimed.platform} done={!!stepUp}
              onGo={() => {
                const u = userId && stepUpUrl(claimed.platform, userId, window.location.pathname);
                if (u) window.location.assign(u);
              }} />,
          } : undefined}
          onConfirm={acceptClaimed}
          onCancel={() => { setClaimed(null); setVerdict(null); setStepUp(null); }}
        />
      )}

      {returnError && (
        <div className="card border-red-500/30 p-3.5">
          <p className="text-[13px] font-bold">
            {W(lang, "That did not finish.", "Eso no se completó.")}
          </p>
          <p className="mt-0.5 text-[12.5px] opacity-65">
            {W(lang, "Nothing was connected and nothing was saved. Tap connect again to try once more.",
                     "No se conectó ni se guardó nada. Toca conectar otra vez para reintentar.")}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {PLATFORMS.map(p => {
          const c = connFor(p.key);
          const oneTap = canTapToConnect(p.key);
          return (
            <div key={p.key} className="card p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink/10 dark:border-white/15">
                  <PlatformMark name={p.key} size={20} onChip={false} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{p.label}</p>
                  {c ? (
                    <p className="truncate text-[12.5px] opacity-55">
                      @{c.username}{" "}
                      {c.is_verified
                        ? <span className="font-bold text-teal-deep dark:text-teal-light">{W(lang, "· verified", "· verificado")}</span>
                        : <span>{W(lang, "· you told us", "· tú nos lo dijiste")}</span>}
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
                ) : oneTap ? (
                  <button onClick={() => tap(p.key)} disabled={!userId || busy}
                    className="btn-brand shrink-0 !px-3.5 !py-1.5 text-[12.5px]">
                    {W(lang, "Connect", "Conectar")}
                  </button>
                ) : (
                  <button onClick={() => { setEditing(editing === p.key ? null : p.key); setHandle(""); }}
                    className="btn-ghost shrink-0 !px-3 !py-1.5 text-[12.5px]" disabled={!userId}>
                    {W(lang, "Add handle", "Agregar usuario")}
                  </button>
                )}
              </div>

              {oneTap && !c && (
                <p className="mt-2 text-[11.5px] leading-snug opacity-50">
                  {W(lang, `${p.label} will ask you to confirm it is you. There is no code to copy.`,
                           `${p.label} te pedirá confirmar que eres tú. No hay ningún código que copiar.`)}
                </p>
              )}

              {editing === p.key && !c && (
                <>
                  <div className="mt-3 flex gap-2">
                    <input value={handle} onChange={e => setHandle(e.target.value)}
                      placeholder={W(lang, "@yourhandle", "@tuusuario")} autoFocus
                      className="ow-edge w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none placeholder:opacity-50" />
                    <button onClick={() => add(p.key)} disabled={!handle.trim() || busy}
                      className="btn-brand shrink-0 !px-4 disabled:opacity-50">
                      {busy ? "…" : W(lang, "Add", "Agregar")}
                    </button>
                  </div>
                  {/* Say exactly what this does and does not do. The old screen called the result
                      "self-reported", which is our word, not a member's. */}
                  <p className="mt-1.5 text-[11.5px] leading-snug opacity-55">
                    {W(lang,
                      `This shows your ${p.label} name on your profile. It does not bring your posts across — that needs ${p.label} to confirm it is you, and we are switching that on platform by platform.`,
                      `Esto muestra tu nombre de ${p.label} en tu perfil. No trae tus publicaciones — para eso ${p.label} debe confirmar que eres tú, y lo estamos activando plataforma por plataforma.`)}
                  </p>
                </>
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
    </div>
  );
}

/**
 * THE SECOND STEP — a forced fresh sign-in at the platform.
 *
 * ⚠️ THIS REPLACES THE PHOTO PUZZLE, AND THE PUZZLE WAS MY MISTAKE. I proposed showing nine
 * thumbnails and asking the member to pick the three from the account they were claiming.
 * TESTING took it apart on 8 October: **the attacker is somebody who already controls the
 * account.** They can open it and look at its posts, and most of those posts are public anyway.
 * The thief passes the puzzle as easily as the owner, so it filters nobody while costing every
 * honest person ten seconds. A control that does not control is worse than no control, because
 * everyone downstream believes a check happened.
 *
 * A forced fresh sign-in is different in the one way that matters: it cannot be satisfied by
 * the session the thief is holding. The platform asks for the password or the passkey again,
 * right now, and its own risk engine gets a second look at them.
 *
 * It is still one tap and there is still no code to copy anywhere, which is the rule that has
 * governed this flow from the start.
 */
function FreshSignIn({ lang, platform, done, onGo }: {
  lang: string; platform: string; done: boolean; onGo: () => void;
}) {
  const name = platform.charAt(0).toUpperCase() + platform.slice(1);
  if (done) return (
    <p className="text-[12.5px] font-bold text-[#17A45C]">
      {W(lang, `✓ ${name} confirmed it is you.`, `✓ ${name} confirmó que eres tú.`)}
    </p>
  );
  return (
    <>
      <p className="text-[12.5px] font-bold">
        {W(lang, `One more tap on ${name}`, `Un toque más en ${name}`)}
      </p>
      <p className="mt-0.5 text-[11.5px] leading-snug opacity-60">
        {W(lang,
          `${name} will ask you to sign in again, right now, to prove the account is yours. There is no code to copy.`,
          `${name} te pedirá iniciar sesión otra vez, ahora mismo, para comprobar que la cuenta es tuya. No hay ningún código que copiar.`)}
      </p>
      <button type="button" onClick={onGo} className="btn-brand mt-2.5 w-full !py-2 text-[13px]">
        {W(lang, `Confirm on ${name}`, `Confirmar en ${name}`)}
      </button>
    </>
  );
}
