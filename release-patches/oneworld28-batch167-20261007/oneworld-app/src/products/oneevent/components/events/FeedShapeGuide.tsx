import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import EventBlockCard from "@evt/components/events/EventBlockCard";
import type { FeedPreview } from "@oneworld/shell";

/**
 * FEED SHAPE GUIDE — the dimensions BEFORE the file is picked, and the real card after.
 * ============================================================================================
 * Lee, 12 Oct 2026: *"we should mention the dimensions and what we can do is at least show… in
 * the preview… this is how it will look as a flyer. Here's the preview for how it looks with the
 * feed… they need to have the dimensions even before they upload anything… no one's going to go
 * and crop their own current flyer. And plus, we got to think about videos, too."*
 *
 * Overlay 29 stopped us CROPPING a good flyer (the storage URL asked for a width with no height,
 * so the render endpoint kept the original height and cut the sides off — every feed image in
 * every product, 30 Sep to 12 Oct). This is the other half: stop the wrong-shaped file being
 * chosen in the first place, because a host who uploads a 16:9 banner still ends up with a small
 * picture on a blurred backing — honest, but not what they wanted.
 *
 * ── WHY THE NUMBERS ARE WHAT THEY ARE ───────────────────────────────────────────────────────
 * They are measured off the card, not chosen. `EventBlockCard` draws `aspect-[4/5]` and passes
 * `fitRatio={0.8} fitPadBottom="24%"` to the strip. So:
 *   · 4 wide by 5 tall is the shape that fills the card with nothing left over → 1080 × 1350.
 *   · the bottom 24% carries the event name, date, venue and the ticket button, over a dark
 *     gradient. Anything a host puts down there is covered. Hence the shaded band, which is
 *     drawn at the same 24% rather than eyeballed.
 * If either number changes in the card, this panel is wrong — they are repeated in ONE place
 * here (CARD_RATIO / OVERLAY_SHARE) so the fix is one line.
 *
 * ── THE PREVIEW IS THE REAL CARD, NOT A PICTURE OF ONE ──────────────────────────────────────
 * This renders `EventBlockCard` itself, with the host's own title, date and venue and their own
 * slides. A hand-drawn mock would be a second copy of the card's layout and would drift from it
 * within a release — and the whole point is to show the host the truth. The only thing it does
 * not do is navigate: `href` is "#" and the card is wrapped in a container that swallows clicks,
 * because a preview that walks you out of a half-filled form would lose the draft.
 *
 * 300px wide is the real width of a feed card on a 390px phone (two 16px gutters, two 29px of
 * lane peek). Previewing at desktop width would flatter the design and hide exactly the problem
 * Lee is pointing at.
 *
 * ── VIDEO ───────────────────────────────────────────────────────────────────────────────────
 * Same shape, and that is worth saying out loud because the instinct for video is landscape. A
 * video in the feed plays muted and looping inside the same 4:5 box, so a 16:9 clip is letterboxed
 * into a strip. The copy says so rather than leaving the host to find out.
 *
 * Seven languages, kept beside the control the way `PhotoDeck`'s menu is, so the frozen locale
 * release is untouched.
 */

/** From `EventBlockCard`: `aspect-[4/5]`, `fitRatio={0.8}`. */
const CARD_RATIO = 4 / 5;
/** From `EventBlockCard`: `fitPadBottom="24%"` — the name/date/button band. */
const OVERLAY_SHARE = 0.24;
/** A feed card on a 390px phone. Measured, not rounded to something tidy. */
const PREVIEW_W = 300;

type L = Record<string, string>;
const T: Record<string, L> = {
  best: {
    en: "Best shape: 1080 × 1350 (4 wide by 5 tall)",
    es: "Mejor formato: 1080 × 1350 (4 de ancho por 5 de alto)",
    co: "Mejor formato: 1080 × 1350 (4 de ancho por 5 de alto)",
    de: "Bestes Format: 1080 × 1350 (4 breit, 5 hoch)",
    ru: "Лучший формат: 1080 × 1350 (4 в ширину, 5 в высоту)",
    zh: "最佳尺寸：1080 × 1350（宽 4、高 5）",
    pt: "Melhor formato: 1080 × 1350 (4 de largura por 5 de altura)",
  },
  bandLabel: {
    en: "Your name, date and button go here",
    es: "Aquí van tu nombre, fecha y botón",
    co: "Aquí van tu nombre, fecha y botón",
    de: "Hier stehen Name, Datum und Button",
    ru: "Здесь название, дата и кнопка",
    zh: "名称、日期和按钮显示在这里",
    pt: "Aqui ficam o nome, a data e o botão",
  },
  keepClear: {
    en: "Keep words out of the bottom quarter — the event name and date sit over it.",
    es: "No pongas texto en el cuarto inferior: el nombre y la fecha van encima.",
    co: "No pongas texto en el cuarto inferior: el nombre y la fecha van encima.",
    de: "Keine Schrift im unteren Viertel — Name und Datum liegen darüber.",
    ru: "Не размещайте текст в нижней четверти — там название и дата.",
    zh: "底部四分之一不要放文字——活动名称和日期会盖在上面。",
    pt: "Não coloque texto no quarto de baixo — o nome e a data ficam por cima.",
  },
  anyShape: {
    en: "Any other shape still works — it shows whole, never cut, just smaller.",
    es: "Cualquier otro formato funciona: se ve completo, sin cortes, solo más pequeño.",
    co: "Cualquier otro formato funciona: se ve completo, sin cortes, solo más pequeño.",
    de: "Jedes andere Format geht auch — es wird ganz gezeigt, nie beschnitten, nur kleiner.",
    ru: "Любой другой формат тоже подойдёт — покажем целиком, без обрезки, просто меньше.",
    zh: "其他尺寸也可以——会完整显示，不会被裁掉，只是小一些。",
    pt: "Qualquer outro formato funciona — aparece inteiro, sem cortes, só menor.",
  },
  video: {
    en: "Video: same 4 by 5 shape. It plays with no sound in the feed, so a wide clip gets thin bars.",
    es: "Video: el mismo formato 4 por 5. Se reproduce sin sonido en el feed, así que un clip ancho queda con bandas.",
    co: "Video: el mismo formato 4 por 5. Se reproduce sin sonido en el feed, así que un clip ancho queda con bandas.",
    de: "Video: gleiches 4-zu-5-Format. Im Feed läuft es ohne Ton, ein breiter Clip bekommt Balken.",
    ru: "Видео: тот же формат 4 к 5. В ленте идёт без звука, поэтому широкий клип будет с полосами.",
    zh: "视频：同样的 4 比 5。在信息流里静音播放，所以宽屏片段会有黑边。",
    pt: "Vídeo: o mesmo formato 4 por 5. Toca sem som no feed, então um clipe largo fica com faixas.",
  },
  show: {
    en: "See it in the feed",
    es: "Ver cómo se ve en el feed",
    co: "Ver cómo se ve en el feed",
    de: "Im Feed ansehen",
    ru: "Посмотреть в ленте",
    zh: "查看信息流中的样子",
    pt: "Ver como fica no feed",
  },
  hide: {
    en: "Hide the feed preview",
    es: "Ocultar la vista del feed",
    co: "Ocultar la vista del feed",
    de: "Feed-Vorschau ausblenden",
    ru: "Скрыть предпросмотр ленты",
    zh: "隐藏信息流预览",
    pt: "Esconder a prévia do feed",
  },
  isPreview: {
    en: "This is the real feed card, at the size it shows on a phone. Tapping it does nothing here.",
    es: "Esta es la tarjeta real del feed, del tamaño que se ve en un teléfono. Tocarla aquí no hace nada.",
    co: "Esta es la tarjeta real del feed, del tamaño que se ve en un teléfono. Tocarla aquí no hace nada.",
    de: "Das ist die echte Feed-Karte in Handy-Größe. Ein Tippen tut hier nichts.",
    ru: "Это настоящая карточка ленты в размере телефона. Нажатие здесь ничего не делает.",
    zh: "这是真实的信息流卡片，按手机上的尺寸显示。在这里点击不会有反应。",
    pt: "Este é o cartão real do feed, no tamanho que aparece no celular. Tocar aqui não faz nada.",
  },
  noMedia: {
    en: "Add a photo or video to see the preview.",
    es: "Agrega una foto o un video para ver la vista previa.",
    co: "Agrega una foto o un video para ver la vista previa.",
    de: "Foto oder Video hinzufügen, um die Vorschau zu sehen.",
    ru: "Добавьте фото или видео, чтобы увидеть предпросмотр.",
    zh: "添加照片或视频即可预览。",
    pt: "Adicione uma foto ou um vídeo para ver a prévia.",
  },
  untitled: {
    en: "Your event name", es: "El nombre de tu evento", co: "El nombre de tu evento",
    de: "Name deiner Veranstaltung", ru: "Название вашего события",
    zh: "你的活动名称", pt: "O nome do seu evento",
  },
};
const t = (lang: string, key: keyof typeof T) => T[key][lang] ?? T[key].en;

export default function FeedShapeGuide({
  lang, slides, poster, title, dateLabel, venueLabel, cta,
}: {
  lang: string;
  /** The host's real media, lead first — the same list the feed would get. */
  slides: FeedPreview[];
  poster: string | null;
  title: string;
  dateLabel?: string | null;
  venueLabel?: string | null;
  cta?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasMedia = slides.length > 0;
  /* Percentages, so the diagram is the card's own proportions at any size. */
  const bandPct = `${Math.round(OVERLAY_SHARE * 100)}%`;

  return (
    <div className="mb-3 rounded-2xl border border-ink/15 bg-secondary/40 p-3 dark:border-white/15 dark:bg-white/[0.04]">
      <div className="flex gap-3">
        {/* The shape itself, drawn at the card's real ratio with the real overlay band. */}
        <div className="shrink-0" style={{ width: 56 }} aria-hidden="true">
          <div className="relative overflow-hidden rounded-md border border-ink/25 bg-primary/15 dark:border-white/25"
            style={{ aspectRatio: String(CARD_RATIO) }}>
            <div className="absolute inset-x-0 bottom-0 bg-ink/35 dark:bg-black/45" style={{ height: bandPct }} />
          </div>
        </div>
        <div className="min-w-0">
          {/* PUB30: at 390px the line wrapped mid-phrase ("(4 wide / by 5 tall)"). Each half is
              kept whole, so the only break is between the size and the shape. */}
          <p className="text-[12px] font-bold leading-tight">
            {t(lang, "best").split(/\s?(?=[(（])/).map((part, i) => (
              <span key={i}>{i > 0 ? (part.startsWith("（") ? <wbr /> : " ") : null}<span className="whitespace-nowrap">{part}</span></span>
            ))}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t(lang, "keepClear")}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t(lang, "anyShape")}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t(lang, "video")}</p>
        </div>
      </div>

      {/* With nothing uploaded there is no preview to give, so there is no button — just the
          sentence saying what would unlock it. A greyed-out control sitting next to its own
          excuse is a control that half works, and it was also squeezing the label into two
          lines ("See it in the / feed"), which breaks the label mid-phrase. */}
      <div className="mt-2.5">
        {hasMedia ? (
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-primary underline decoration-dotted underline-offset-4"
          >
            {open ? <EyeOff className="h-3 w-3 shrink-0" /> : <Eye className="h-3 w-3 shrink-0" />}
            {open ? t(lang, "hide") : t(lang, "show")}
          </button>
        ) : (
          <p className="text-[11px] leading-snug text-muted-foreground">{t(lang, "noMedia")}</p>
        )}
      </div>

      {open && hasMedia && (
        <div className="mt-3">
          {/* The card is the live component. The wrapper swallows clicks so a preview can never
              navigate out of a half-filled form and lose the draft. */}
          <div
            className="mx-auto"
            style={{ width: PREVIEW_W, maxWidth: "100%" }}
            onClickCapture={e => { e.preventDefault(); e.stopPropagation(); }}
          >
            <EventBlockCard
              slides={slides}
              coverUrl={poster}
              href="#"
              lang={lang}
              cta={cta}
              title={title.trim() || t(lang, "untitled")}
              dateLabel={dateLabel ?? null}
              venueLabel={venueLabel ?? null}
            />
          </div>
          <p className="mt-2 text-center text-[10px] leading-snug text-muted-foreground">{t(lang, "isPreview")}</p>
        </div>
      )}
    </div>
  );
}
