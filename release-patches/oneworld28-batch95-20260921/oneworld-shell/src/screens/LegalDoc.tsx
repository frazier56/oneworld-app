import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Markdown } from "../components/Markdown";

/** Read-only Markdown legal page. Draft content remains visibly gated unless the route explicitly
 * marks an approved document as published. Acceptance is handled by the calling product flow. */
export default function LegalDoc({ title, source, published = false }: { title: string; source: string; published?: boolean }) {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = published ? "index, follow" : "noindex, nofollow";
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = `${title}${published ? "" : " — DRAFT (not published)"} · One World Labs`;
    return () => {
      try { document.head.removeChild(meta); } catch { /* already gone */ }
      document.title = prevTitle;
    };
  }, [title, published]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      {!published && <div
        role="note"
        className="mb-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] font-semibold leading-relaxed text-amber-700 dark:text-amber-300"
      >
        DRAFT — NOT PUBLISHED, NOT BINDING. This page is here for review only. It is not the live
        agreement, nothing on it is in effect, and creating or using an account does not accept it.
      </div>}

      {published && <nav aria-label="Legal documents" className="mb-8 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-brand-deep dark:text-brand-light">
        <a href="/terms">Platform Terms</a>
        <a href="/privacy">Privacy Policy</a>
        <a href="/onehome/terms">OneHome Rental Terms</a>
      </nav>}

      <article className="text-[16px] leading-relaxed">
        <Markdown source={source} />
      </article>

      <Link to="/" className="ow-tap mt-8 block text-center text-[13px] font-medium opacity-55">
        Back to One World
      </Link>
    </div>
  );
}
