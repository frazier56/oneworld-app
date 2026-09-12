import { useI18n, type Lang } from "../lib/i18n";

const ONE_WORLD_HOME = "https://www.oneworldlabs.ai/";
const HOME_LABELS: Record<Lang, string> = {
  en: "Go to the One World Labs home page",
  co: "Ir a la página principal de One World Labs",
  es: "Ir a la página principal de One World Labs",
  de: "Zur Startseite von One World Labs",
  ru: "Перейти на главную страницу One World Labs",
  zh: "前往 One World Labs 首页",
  pt: "Ir para a página inicial da One World Labs",
};

/** Shared, same-tab way back to the company home from neutral One ID screens. */
export default function OneWorldHomeLink() {
  const { lang } = useI18n();
  return (
    <div className="flex justify-center pt-3">
      <a
        href={ONE_WORLD_HOME}
        aria-label={HOME_LABELS[lang] ?? HOME_LABELS.en}
        className="ow-tap inline-flex min-h-11 items-center justify-center rounded-full px-4
                   text-[12px] font-semibold tracking-wide text-ink/75 dark:text-paper/80
                   hover:underline focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-ink dark:focus-visible:ring-paper"
      >
        <span data-no-translate>One World Labs</span>
      </a>
    </div>
  );
}
