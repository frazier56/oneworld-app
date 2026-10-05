import { TextAlerts } from "@oneworld/shell";

/* The listing form's "Text me about showings and messages" — now the shell's one TextAlerts
   component, showing only the Homes types. Same member-level setting as Settings → Text messages
   (Lee, 2 Oct 2026: every alert can be a text, configurable by app and by type). */
export default function ListingTextAlerts({ lang }: { lang: string }) {
  return <div className="mt-4"><TextAlerts lang={lang} scope="homes" /></div>;
}
