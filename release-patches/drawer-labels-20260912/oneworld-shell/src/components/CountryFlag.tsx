import { flagSrc } from "../lib/flags";

/** Use the same actual flag assets as the language picker, including bundled core markets. */
export default function CountryFlag({ iso }: { iso: string }) {
  return <img src={flagSrc(iso.toLowerCase())} alt={iso.toUpperCase()} width={28} height={20}
    className="inline-block h-5 w-7 shrink-0 rounded-sm object-cover" />;
}
