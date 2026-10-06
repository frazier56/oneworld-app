import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Markdown } from "../components/Markdown";
import { useI18n, W } from "../lib/i18n";

/** Read-only Markdown legal page. Draft content remains visibly gated unless the route explicitly
 * marks an approved document as published. Acceptance is handled by the calling product flow. */
export default function LegalDoc({ title, source, published = false }: { title: string; source: string; published?: boolean }) {
  const { lang } = useI18n();
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = published ? "index, follow" : "noindex, nofollow";
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = `${title}${published ? "" : W(lang, " — DRAFT (not published)", " — BORRADOR (no publicado)")} · One World Labs`;
    return () => {
      try { document.head.removeChild(meta); } catch { /* already gone */ }
      document.title = prevTitle;
    };
  }, [title, published, lang]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      {!published && <div
        role="note"
        className="mb-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] font-semibold leading-relaxed text-amber-700 dark:text-amber-300"
      >
        {W(lang, "DRAFT — NOT PUBLISHED, NOT BINDING. This page is here for review only. It is not the live agreement, nothing on it is in effect, and creating or using an account does not accept it.", "BORRADOR — NO PUBLICADO, NO VINCULANTE. Esta página está aquí solo para revisión. No es el acuerdo vigente, nada de lo que dice está en vigor, y crear o usar una cuenta no implica aceptarlo.")}
      </div>}

      {published && <nav aria-label={W(lang, "Legal documents", "Documentos legales")} className="mb-8 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-brand-deep dark:text-brand-light">
        <a href="/terms">{W(lang, "Platform Terms", "Términos de la plataforma")}</a>
        <a href="/privacy">{W(lang, "Privacy Policy", "Política de privacidad")}</a>
        <a href="/onehome/terms">{W(lang, "OneHome Rental Terms", "Términos de arriendo de OneHome")}</a>
      </nav>}

      <article className="text-[16px] leading-relaxed">
        <Markdown source={source} />
      </article>

      <Link to="/" className="ow-tap mt-8 block text-center text-[13px] font-medium opacity-55">
        {W(lang, "Back to One World", "Volver a One World")}
      </Link>
    </div>
  );
}
