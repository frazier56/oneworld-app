import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useOneId } from "../lib/oneId";
import { supabase } from "../lib/supabase";
import { useAsync } from "../lib/useAsync";
import { useBadgeTier } from "../lib/useBadgeTier";
import { appProfile, PRODUCT_BRAND, type AppKey } from "../lib/oneWorld";
import {
  IconEye, IconShare, IconGear, IconCheck,
  IconFlame, IconGlobe, IconPassport, IconTicket, IconPin,
} from "../components/ActionIcons";
import ClampBlock from "../components/ClampBlock";
import { productHref } from "../routes";
import { getAppLinks } from "../lib/appLinks";
import { PUBLIC_SECTIONS, isSectionPublic, setSectionPublic, type SectionKey } from "../lib/publicSections";
import ScoreDonut from "../components/ScoreDonut";
import MyWorldHub from "../components/MyWorldHub";
import PassportStrip from "../components/passport/PassportStrip";
import MediaWall from "../components/MediaWall";
import ConnectedPlatforms from "../components/ConnectedPlatforms";
import ScreenHeading from "../components/ScreenHeading";
import { screenTitle } from "../lib/screenTitles";
import { uploadProfilePhoto } from "../lib/photoUpload";

/**
 * THE PROFILE SCREEN — half shell, half app slot.
 * ============================================================================================
 * The rows here are the ones that are IDENTICAL on every app (SHELL_CONTRACT): avatar · name ·
 * title · location · OneScore ring · complete-your-profile · My World hub · Reputation Passport ·
 * connected platforms (metrics only) · bio · "on my public profile" toggles · the actions row.
 * The app-specific bits — quick tiles, the stats row, the calendar card — are passed in as slots,
 * so an app fills its own holes without forking the screen. Order matches OneJob's ~50-variation
 * reference: My World above the passport, one entry point to the hub.
 *
 * Identity (name/photo/title) comes from the shared One ID, not a per-app fetch; bio/location/score
 * come from the `profiles` row. Score is `score_v9_snapshot` — the ONE published number every
 * sibling reads, never a per-app local calculation.
 */
/* The four "On my public profile" rows, keyed exactly as `PUBLIC_SECTIONS` is. Kept beside the
   screen that renders them rather than in `publicSections.ts`, because that module is the shared
   PREDICATE — the one thing the switch and the public gate both call — and putting React
   components in it would make every consumer of a boolean import an icon set. */
const SECTION_ICON: Record<SectionKey, (p: { size?: number; className?: string }) => JSX.Element> = {
  show_score: IconFlame,
  show_world: IconGlobe,
  show_passport: IconPassport,
  show_events: IconTicket,
};

export default function ProfileScreen({
  product,
  tilesSlot,
  mediaOwnedByTiles = false,
  statsSlot,
  calendarSlot,
  settingsHref,
}: {
  product: AppKey;
  /** App-specific quick tiles (My jobs, Reviews, …). */
  tilesSlot?: ReactNode;
  /** The product's own tiles already render this person's media — do not render it twice. */
  mediaOwnedByTiles?: boolean;
  /** App-specific stats row (labels differ per app). */
  statsSlot?: ReactNode;
  /** App-specific calendar card — only Job/Event/Agent pass one. */
  calendarSlot?: ReactNode;
  /** Where the Settings action goes. Defaults to the product's /settings. */
  settingsHref?: string;
}) {
  const { lang } = useI18n();
  const isEs = lang === "es" || lang === "co";
  const { userId, displayName, photoUrl, jobTitle, signOutEverywhere, signOutError } = useOneId();
  const { tier } = useBadgeTier(userId);
  const [shared, setShared] = useState(false);
  const [links, setLinks] = useState<Record<string, boolean>>({});

  /* ── ONE EDIT BUTTON, AND THE WHOLE PAGE EDITS (Lee, 10 Aug 2026) ──────────────────────────
     *"Put one Edit button at the bottom and make the entire page editable — including changing
     your photo, uploading your photo. Remove the pencil-with-edit-icon from the bio."*

     There used to be three ways in — a pencil beside the bio, the "complete your profile" card,
     and a Settings-shaped link — all of them navigating AWAY to a separate form. So editing your
     own profile meant leaving the page you were looking at, and the thing you wanted to change
     (your photo) was not on that form at all.

     Now the page itself is the editor. `editing` swaps the display fields for inputs in place, so
     what you type is on the layout you are going to keep. */
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ full_name: "", job_title: "", location: "", bio: "" });
  const [draftPhoto, setDraftPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [showProfileNudge, setShowProfileNudge] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const prof = useAsync(async () => {
    const { data } = await supabase.from("profiles")
      .select("bio, location, score_v9_snapshot").eq("id", userId!).maybeSingle();
    return data as { bio: string | null; location: string | null; score_v9_snapshot: number | null } | null;
  }, [userId], !!userId);

  useAsync(async () => {
    if (!userId) return {};
    const l = await getAppLinks(userId);
    setLinks(l);
    return l;
  }, [userId], !!userId);

  /* Two DIFFERENT destinations, which I'd wrongly collapsed into one:
       · worldHref  → the One World PAGE ("View my World") — every app shown as a panel with real
         content. This is where My World and the passport's "One World" link go.
       · publicHref → the PUBLIC PROFILE ("View public") — what a stranger sees of this profile. */
  const activeUserId = userId ?? "";
  const worldHref = productHref(product, `/world/${encodeURIComponent(activeUserId)}`);
  const publicHref = appProfile(product, activeUserId);
  const score = prof?.score_v9_snapshot ?? null;
  const bio = prof?.bio ?? null;
  const location = prof?.location ?? null;

  /* Seed the draft from what is on screen the moment editing opens — never on every render, or
     a keystroke would be overwritten by the fetched value on the next one. */
  const startEditing = () => {
    setDraft({
      full_name: displayName ?? "",
      job_title: jobTitle ?? "",
      location: location ?? "",
      bio: bio ?? "",
    });
    setDraftPhoto(null);
    setSaveErr(null);
    setEditing(true);
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file || !userId) return;
    setSaveErr(null);
    setSaving(true);
    const res = await uploadProfilePhoto(userId, file);
    setSaving(false);
    if ("error" in res) { setSaveErr(res.error); return; }
    /* Held in the draft, not written yet — Cancel must actually cancel. The FILE is already in
       storage (there is no way to upload without uploading), but the profile keeps its old photo
       unless the person saves. An orphaned object is cheap; a photo you did not agree to is not. */
    setDraftPhoto(res.url);
  };

  const saveProfile = async () => {
    if (!userId) return;
    setSaving(true);
    setSaveErr(null);
    /* Only the fields this screen actually edits. Never spread a draft object into the update —
       that is how a computed column (a score, a verification flag) gets written from a form. */
    const patch: Record<string, string | null> = {
      full_name: draft.full_name.trim() || null,
      job_title: draft.job_title.trim() || null,
      location: draft.location.trim() || null,
      bio: draft.bio.trim() || null,
    };
    if (draftPhoto) patch.photo_url = draftPhoto;
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    setSaving(false);
    if (error) {
      /* Show the server's own sentence. A silent failed save is the worst outcome here: the
         person believes their profile changed and it did not. */
      console.error("[ProfileScreen] profile save failed:", error.message);
      setSaveErr(error.message);
      return;
    }
    setEditing(false);
    setJustSaved(true);
    /* The identity half (name, photo, title) lives in One ID and is read by every sibling screen,
       so the page is reloaded rather than hand-patched — one source of truth, refetched. */
    setTimeout(() => window.location.reload(), 350);
  };


  const [toggleError, setToggleError] = useState(false);
  const toggleSection = async (key: SectionKey, next: boolean) => {
    setLinks(l => ({ ...l, [key]: next }));
    /* Never trust a write you have not read back — a switch that flips on screen while the
       server write fails is Lee's exact "the toggles don't work" report. On failure the switch
       REVERTS and says so, instead of lying until the public page contradicts it. */
    const { error } = await setSectionPublic(activeUserId, key, next);
    if (error) {
      setLinks(l => ({ ...l, [key]: !next }));
      setToggleError(true);
      setTimeout(() => setToggleError(false), 2600);
    }
  };

  const shareProfile = async () => {
    const first = (displayName ?? "").split(" ")[0];
    const brand = PRODUCT_BRAND[product].name;
    if (navigator.share) {
      try { await navigator.share({ title: first ? `${first} on ${brand}` : brand, url: publicHref }); return; }
      catch { /* dismissed → copy */ }
    }
    try { await navigator.clipboard.writeText(publicHref); setShared(true); setTimeout(() => setShared(false), 1800); } catch { /* ignore */ }
  };

  const completion = (() => {
    const have = [!!photoUrl, !!jobTitle, (bio?.length ?? 0) >= 50, !!location].filter(Boolean).length;
    return Math.round((have / 4) * 100);
  })();
  const profileNudgeKey = userId ? `ow.profile.nudge.v2.${userId}` : "";

  useEffect(() => {
    if (!profileNudgeKey || completion !== 0 || editing) return;
    try {
      if (localStorage.getItem(profileNudgeKey) === "1") return;
    } catch { /* private mode: show it this session only */ }
    const timer = window.setTimeout(() => setShowProfileNudge(true), 250);
    return () => window.clearTimeout(timer);
  }, [completion, editing, profileNudgeKey]);

  const dismissProfileNudge = () => {
    if (profileNudgeKey) {
      try { localStorage.setItem(profileNudgeKey, "1"); } catch { /* storage unavailable */ }
    }
    setShowProfileNudge(false);
  };

  if (!userId) return null;

  return (
    <div className="space-y-4">
      {/* Shell-owned title in all SEVEN languages — see lib/screenTitles.ts. */}
      <ScreenHeading>{screenTitle(lang, "profile")}</ScreenHeading>

      {showProfileNudge && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/45 px-3 pb-3 backdrop-blur-sm sm:items-center sm:pb-0"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-nudge-title"
          onClick={dismissProfileNudge}
        >
          <div
            className="glass-modal w-full max-w-sm rounded-3xl border border-white/60 bg-white/[0.97] p-5 shadow-2xl dark:border-white/10 dark:bg-ink/[0.97]"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-3 inline-flex rounded-full bg-brand/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-brand">
              One ID
            </div>
            <h2 id="profile-nudge-title" className="text-xl font-extrabold leading-tight">
              {isEs ? "Haz que tu perfil trabaje por ti" : "Make your profile work for you"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed opacity-70">
              {isEs
                ? "Tu perfil viaja contigo por OneEvent, OneJob, OneScore y OneSocial. Agrega una foto, ciudad y una breve biografía para que anfitriones, clientes y nuevas conexiones sepan quién eres."
                : "Your profile travels with you across OneEvent, OneJob, OneScore and OneSocial. Add a photo, city and short bio so hosts, clients and new connections know who you are."}
            </p>
            <div className="mt-4 grid gap-2 text-[13px] font-semibold text-ink/75 dark:text-white/75">
              <p>{isEs ? "Construye confianza antes de enviar mensajes o comprar entradas." : "Build trust before you message, hire, sell or buy tickets."}</p>
              <p>{isEs ? "Conecta tus señales para mejorar tu OneScore." : "Connect your signals to make your OneScore stronger."}</p>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => { dismissProfileNudge(); startEditing(); }}
                className="btn-primary flex-1 text-center"
              >
                {isEs ? "Crear perfil" : "Start profile"}
              </button>
              <button type="button" onClick={dismissProfileNudge} className="btn-ghost flex-1 text-center">
                {isEs ? "Luego" : "Later"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Identity + score ring. In edit mode the SAME block turns into fields, so what you
             type sits on the layout you are going to keep — rather than on a separate form you
             have to imagine your way back from. ── */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          {(draftPhoto ?? photoUrl)
            ? <img src={draftPhoto ?? photoUrl!} className="h-20 w-20 rounded-2xl object-cover" alt="" />
            : <div className="grid h-20 w-20 place-items-center rounded-2xl bg-brand/15 text-3xl font-bold text-brand">{displayName?.[0]?.toUpperCase() ?? "·"}</div>}
          {editing && (
            <>
              {/* The photo was not on the old edit form at ALL, which is the change Lee actually
                  asked for by name. Tapping the picture is the control — a separate "upload"
                  button beside it would be a second thing to find. */}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={saving}
                aria-label={isEs ? "Cambiar foto" : "Change photo"}
                className="absolute inset-0 grid place-items-center rounded-2xl bg-ink/55 text-[11px] font-bold text-white">
                {saving ? "…" : (isEs ? "Cambiar" : "Change")}
              </button>
              {/* `image/*`, deliberately NOT a list of types: on iOS, picking from the photo
                  library through an image/* input makes Safari hand over a JPEG — it transcodes
                  the HEIC on selection. Naming the types explicitly defeats that and hands over
                  the raw .heic. (The bucket policy accepts .heic too, for a raw file arriving
                  from a file manager or a desktop drag.) */}
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { void pickPhoto(e.target.files?.[0]); e.currentTarget.value = ""; }} />
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <input value={draft.full_name} onChange={e => setDraft(d => ({ ...d, full_name: e.target.value }))}
                placeholder={isEs ? "Tu nombre" : "Your name"} aria-label={isEs ? "Nombre" : "Full name"}
                className="card w-full rounded-xl px-3 py-2 text-[15px] font-bold outline-none" />
              <input value={draft.job_title} onChange={e => setDraft(d => ({ ...d, job_title: e.target.value }))}
                placeholder={isEs ? "Ej. Electricista" : "e.g. Electrician"} aria-label={isEs ? "Profesión" : "What you do"}
                className="card w-full rounded-xl px-3 py-2 text-[13.5px] outline-none" />
              <input value={draft.location} onChange={e => setDraft(d => ({ ...d, location: e.target.value }))}
                placeholder={isEs ? "Ciudad, Estado" : "City, State"} aria-label={isEs ? "Ubicación" : "Your location"}
                className="card w-full rounded-xl px-3 py-2 text-[13px] outline-none" />
            </div>
          ) : (
            <>
              <h2 className="text-lg font-extrabold leading-tight sm:text-xl">{displayName || "—"}</h2>
              {jobTitle && <p className="truncate text-sm opacity-60">{jobTitle}</p>}
              {location && (
                <p className="flex items-center gap-1 truncate text-[13px] opacity-50">
                  <IconPin size={12} className="shrink-0" />{location}
                </p>
              )}
            </>
          )}
        </div>
        {score != null && !editing && (
          <div className="flex shrink-0 flex-col items-center">
            <ScoreDonut score={score} size={64} tier={tier ?? undefined} />
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide opacity-50">OneScore™</span>
          </div>
        )}
      </div>

      {/* ── Complete your profile ── (owner coaching; hides at 100%) */}
      {completion < 100 && (
        <div className="card p-4">
          <button type="button" onClick={startEditing} className="block w-full text-left">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm font-bold">{isEs ? "Completa tu perfil" : "Complete your profile"}</p>
              <span className="text-sm font-extrabold text-brand">{completion}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-brand/10">
              <div className="h-full rounded-full" style={{ width: `${completion}%`, background: "linear-gradient(140deg,#15C2B2,#0F766E)" }} />
            </div>
            <p className="mt-2 text-[12.5px] leading-snug opacity-60">
              {isEs
                ? "Tu One ID se muestra en todos los productos de One World Labs."
                : "Your One ID appears across every One World Labs app."}
            </p>
          </button>
          {completion === 0 && (
            <div className="mt-4 rounded-2xl border border-brand/20 bg-brand/5 p-3">
              <p className="text-sm font-extrabold">
                {isEs ? "Empieza con lo basico" : "Start with the basics"}
              </p>
              <p className="mt-1 text-xs leading-relaxed opacity-70">
                {isEs
                  ? "Agrega una foto, ciudad y una breve biografia. Tu perfil ayuda a anfitriones, clientes y nuevas conexiones a reconocerte en OneEvent, OneJob, OneScore y OneSocial."
                  : "Add a photo, city and short bio. Your profile helps hosts, clients and new connections recognize you across OneEvent, OneJob, OneScore and OneSocial."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── My World, then the passport (Lee's order) ── */}
      <MyWorldHub
        product={product}
        worldHref={worldHref}
        publiclyVisible={isSectionPublic(links, "show_world")}
        onTogglePublic={next => toggleSection("show_world", next)}
      />
      <PassportStrip
        product={product}
        worldHref={worldHref}
        userId={userId}
        score={score}
        name={displayName}
        photo={photoUrl}
        title={jobTitle}
        bio={bio}
        location={location}
      />

      {/* ── App-specific slots ── */}
      {tilesSlot}
      {calendarSlot}

      {/* ── Media (own uploads only) — SHELL (matrix) ────────────────────────────────────
          Suppressed when the product's own tiles already own this person's media.

          Lee, 11 Aug 2026, on OneHome: *"you don't need to have another media section though,
          because you have it wrapped up, rolled up into this section — and the media is very
          different here, because it involves properties."*

          He is right, and it was a real duplicate rather than a styling nit: OneHome's tiles
          already read `media_posts` for the same person, so the profile rendered that person's
          photographs twice, under two different headings, on one screen.

          A PROP, not a per-product branch — the shell still decides the layout and OneHome only
          declares that it has taken the job. Default `false`, so the other five apps are
          untouched. */}
      {!mediaOwnedByTiles && <MediaWall userId={userId} editable />}

      {/* ── Connected platforms (metrics only, no imported media) — SHELL (matrix) ── */}
      <ConnectedPlatforms userId={userId} />

      {statsSlot}

      {/* ── Bio / About ── */}
      <section className="card p-5">
        {/* The pencil-with-edit-icon is GONE (Lee, 10 Aug). It was the only per-field editor on
            the page, it navigated away to a different screen, and it made the bio look like the
            one thing you were allowed to change. */}
        <h2 className="font-bold">{isEs ? "Biografía" : "About"}</h2>
        {editing ? (
          <textarea value={draft.bio} onChange={e => setDraft(d => ({ ...d, bio: e.target.value }))}
            placeholder={isEs ? "Cuéntale a la gente quién eres" : "Tell people who you are"} rows={6}
            aria-label={isEs ? "Biografía" : "About you"}
            className="card mt-2 w-full resize-none rounded-2xl px-4 py-3 text-sm leading-relaxed outline-none" />
        ) : (
          /** ── THE GARBLED TEXT AT THE BOTTOM OF THE PROFILE — ROOT CAUSE ──────────────────
                This was `className="ow-scroll mt-2 max-h-44 …"`. `.ow-scroll` is our own utility
                and it ONLY hides scrollbar chrome — it never sets `overflow`. So `max-h-44`
                capped the box at 176px while the bio kept painting straight out the bottom of
                it, across the actions row and the card below. That is the "jumbled up and
                garbled up" Lee photographed twice; it was never the font and never the emoji.

                Lee, 11 Aug 2026: *"it should be abbreviated — you should only show like 4 lines
                of description before someone can click More and see the rest, and if it expands
                it needs to expand properly and not behind other elements."* `ClampBlock` clamps
                to four lines, shows More only when there genuinely is more, and expands in
                normal flow so it pushes the page down instead of over it. */
          <ClampBlock lines={4} className="mt-2 text-sm leading-relaxed opacity-80">
            {bio || <span className="opacity-50">{isEs ? "Aún no hay biografía." : "Nothing here yet."}</span>}
          </ClampBlock>
        )}
      </section>

      {/* ── What the public sees — one predicate, shared with the public profile gate ── */}
      <section className="card p-5">
        <h2 className="font-bold">{isEs ? "En mi perfil público" : "On my public profile"}</h2>
        <p className="mb-3 mt-0.5 text-[11.5px] leading-snug opacity-55">
          {isEs
            ? "Desactiva cualquiera para ocultarlo a quien visite tu perfil. Tú siempre lo ves."
            : "Turn any of these off to hide it from visitors. You always see them yourself."}
        </p>
        {PUBLIC_SECTIONS.map(sec => {
          const on = isSectionPublic(links, sec.key);
          const label: Record<SectionKey, string> = {
            show_score: isEs ? "Mi puntaje" : "My score",
            show_world: isEs ? "Mi mundo" : "My World",
            // This is the public One World profile card, not an uploaded government ID.
            show_passport: isEs ? "Mi tarjeta de identidad de One World" : "My One World identity card",
            show_events: isEs ? "Mis eventos" : "My events",
          };
          return (
            <div key={sec.key} className="mb-2 flex items-center justify-between">
              {/* ── ICONS, NOT EMOJI (11 Aug 2026) ──────────────────────────────────────
                     These four rows were 🔥 🌐 🛂 🎟️. Lee photographed them on an Android
                     phone: four different optical sizes, labels off a shared baseline, and
                     🎟️ built the same way as the 👁️ that produced a visible tofu box on the
                     actions row. His P1 from 2 Aug: *"an emoji is a different shape on every
                     device."* `SECTION_ICON` maps the same keys to stroked SVGs at the weight
                     every other icon on this screen uses. */}
              <span className="flex items-center gap-2 font-medium">
                {(() => { const I = SECTION_ICON[sec.key]; return <I size={17} className="shrink-0 opacity-60" />; })()}
                {label[sec.key]}
              </span>
              {/* ── THE SWITCH IS 28px TALL; THE TAP TARGET IS 44 ────────────────────────
                     The visible track stays exactly as it was — a taller switch would look
                     wrong next to the label. What changed is the button around it: a `-my-2`
                     padded box, so the thumb can land two pixels above or below the track and
                     still flip it. A control you have to aim at is a control people give up on
                     and then report as "the toggle doesn't work". */}
              <button onClick={() => toggleSection(sec.key, !on)} role="switch" aria-checked={on}
                aria-label={label[sec.key]}
                className="ow-tap -my-2 -mr-2 grid h-11 shrink-0 place-items-center px-2">
                <span aria-hidden className={`relative block h-7 w-12 rounded-full transition ${on ? "bg-teal" : "bg-ink/20 dark:bg-white/20"}`}>
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                </span>
              </button>
            </div>
          );
        })}
        {toggleError && (
          <p className="mt-1 text-[12.5px] font-bold text-red-500">
            {isEs ? "No se guardó — el interruptor volvió a su estado. Reintenta." : "That didn't save — the switch reverted. Try again."}
          </p>
        )}
      </section>

      {/* ── ONE EDIT BUTTON, AT THE BOTTOM (Lee, 10 Aug 2026) ────────────────────────────────
             *"Put one Edit button at the bottom and make the entire page editable."* One control,
             one place, and it turns into Save / Cancel rather than moving or multiplying. */}
      {saveErr && (
        <p className="rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3 text-[13px] font-medium text-red-500">
          {saveErr}
        </p>
      )}
      {editing ? (
        <div className="flex gap-2">
          <button onClick={() => { setEditing(false); setDraftPhoto(null); setSaveErr(null); }} disabled={saving}
            className="btn-ghost flex-1 text-center disabled:opacity-50">{isEs ? "Cancelar" : "Cancel"}</button>
          <button onClick={() => void saveProfile()} disabled={saving}
            className="btn-primary flex-1 text-center disabled:opacity-50">
            {saving ? "…" : (isEs ? "Guardar" : "Save")}
          </button>
        </div>
      ) : (
        <button onClick={startEditing} className="btn-primary w-full text-center">
          {justSaved ? `✓ ${isEs ? "Guardado" : "Saved"}` : (isEs ? "Editar perfil" : "Edit profile")}
        </button>
      )}

      {/* ── ACTIONS ──────────────────────────────────────────────────────────────────────────
             Lee, 11 Aug 2026: *"at the bottom where it says view public view, the text is all
             jumbled up and garbled up."*

             Two separate faults, both of them rules he has already given me:

             1. EMOJI. These were `👁️`, `🔗` and `⚙️` — and 👁️ in particular is an emoji plus a
                variation selector, which Windows and several Android builds render as the glyph
                followed by a visible box or a second, differently-sized eye. That IS the garbling.
                OneJob's rule, his own P1 from 2 Aug: *"an emoji is a different shape on every
                device."* These are the shell's own `ActionIcons` now.
             2. THE PAIR WRAPPED. Same defect as "Keep editing / Publish" — two words against one
                inside `flex-1`, so "View public" broke to a second line, grew its button, and left
                the pair at two different heights. `whitespace-nowrap` + `min-w-0` + a clamped font
                size, exactly as `StickyActions` was fixed.

             `items-stretch` so the two buttons match height even if one ever does wrap. */}
      <div className="flex items-stretch gap-2">
        <Link to={publicHref}
          className="btn-ghost inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 truncate whitespace-nowrap text-center text-[clamp(13px,3.6vw,15px)]">
          <IconEye size={15} className="shrink-0 opacity-70" />
          {isEs ? "Ver público" : "View public"}
        </Link>
        <button onClick={shareProfile}
          className="btn-ghost inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 truncate whitespace-nowrap border-brand/40 bg-brand/[0.06] text-[clamp(13px,3.6vw,15px)] text-brand">
          {shared
            ? <><IconCheck size={15} className="shrink-0" />{isEs ? "Copiado" : "Copied"}</>
            : <><IconShare size={15} className="shrink-0 opacity-80" />{isEs ? "Compartir" : "Share"}</>}
        </button>
      </div>
      <Link to={settingsHref ?? productHref(product, "/settings")}
        className="btn-ghost inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap text-center">
        <IconGear size={15} className="shrink-0 opacity-70" />{isEs ? "Ajustes" : "Settings"}
      </Link>
      <button onClick={() => signOutEverywhere()}
        className="btn-ghost w-full whitespace-nowrap text-red-500">{isEs ? "Cerrar sesión" : "Sign out"}</button>
      {signOutError && <p role="alert" className="text-center text-xs text-red-500">{signOutError}</p>}
    </div>
  );
}
