import { useState } from "react";
import { HomeTop, productHref } from "@oneworld/shell";
import Feed, { type FeedFilter } from "@job/screens/Feed";
import { useI18n } from "@job/lib/i18n";

/**
 * HOME — `/jobs` (index). The shared head, OneJob's feed.
 * ============================================================================================
 * `HomeTop` is the shell's: search box, composer strip and filter-pill row, identical on all
 * eight products. This screen owns only the two things that ARE OneJob's — which pills to show,
 * and what the feed is — and hands them down. Nothing shared is rebuilt here; if the head needs
 * to change it changes once, in the shell, for all eight.
 *
 * `composeTo` is deliberately NOT the raised centre tab. HomeTop defaults a product's composer to
 * its centre action, and OneJob's centre action is "Start a job" — a CONTRACT with money behind
 * it. A person tapping "Write" wants to post, not to hire, so the composer routes back to `/jobs`
 * with `?mode=` and the feed's own composer opens. The centre tab keeps its own, separate job.
 */
export default function Home() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [pill, setPill] = useState<FeedFilter>("all");

  return (
    <HomeTop
      product="onejob"
      onSearch={setQuery}
      composeTo={productHref("onejob")}
      pills={[
        { key: "all", label: t("all") },
        { key: "posts", label: t("postsPill") },
        { key: "jobs", label: t("jobs") },
        { key: "near", label: t("nearMe") },
      ]}
      activePill={pill}
      onPill={k => setPill(k as FeedFilter)}
      feedSlot={<Feed query={query} filter={pill} />}
    />
  );
}
