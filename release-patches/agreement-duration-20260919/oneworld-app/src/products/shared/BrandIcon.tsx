/**
 * AUTHENTIC BRAND MARKS — ported from the approved standalone OneScore build (Lee, 9 Aug:
 * "you need icons for all that type of stuff"). App-level on purpose: the shell stays free of
 * npm dependencies; both OneScore and OneSocial import from here.
 *
 * A platform with no drawn mark gets a branded letter tile — never a blank, never an emoji.
 */
import type { IconType } from "react-icons";
import {
  FaInstagram, FaTiktok, FaYoutube, FaXTwitter, FaFacebook, FaLinkedin,
  FaThreads, FaGithub, FaSnapchat, FaTwitch, FaGoogle, FaUpwork, FaAirbnb,
  FaUber, FaYelp,
} from "react-icons/fa6";
import { SiFiverr, SiZillow, SiTrustpilot } from "react-icons/si";
import { MdOutlineAccountBalance, MdOutlineBadge, MdOutlineWorkspacePremium, MdOutlineLanguage } from "react-icons/md";

const MAP: Record<string, { Icon: IconType; color: string }> = {
  instagram: { Icon: FaInstagram, color: "#E4405F" },
  tiktok: { Icon: FaTiktok, color: "#010101" },
  youtube: { Icon: FaYoutube, color: "#FF0000" },
  x: { Icon: FaXTwitter, color: "#000000" },
  twitter: { Icon: FaXTwitter, color: "#000000" },
  facebook: { Icon: FaFacebook, color: "#1877F2" },
  linkedin: { Icon: FaLinkedin, color: "#0A66C2" },
  threads: { Icon: FaThreads, color: "#000000" },
  github: { Icon: FaGithub, color: "#181717" },
  snapchat: { Icon: FaSnapchat, color: "#e7c500" },
  twitch: { Icon: FaTwitch, color: "#9146FF" },
  google: { Icon: FaGoogle, color: "#4285F4" },
  upwork: { Icon: FaUpwork, color: "#14A800" },
  fiverr: { Icon: SiFiverr, color: "#1DBF73" },
  airbnb: { Icon: FaAirbnb, color: "#FF5A5F" },
  zillow: { Icon: SiZillow, color: "#006AFF" },
  bbb: { Icon: MdOutlineAccountBalance, color: "#00548b" },
  trustpilot: { Icon: SiTrustpilot, color: "#00B67A" },
  yelp: { Icon: FaYelp, color: "#FF1A1A" },
  uber: { Icon: FaUber, color: "#000000" },
  /* Credential rows use neutral drawn glyphs — they are categories, not brands. */
  identity: { Icon: MdOutlineBadge, color: "#0F766E" },
  license: { Icon: MdOutlineWorkspacePremium, color: "#96690A" },
  certification: { Icon: MdOutlineWorkspacePremium, color: "#5B21B6" },
  website: { Icon: MdOutlineLanguage, color: "#334155" },
};

/** LatAm ride/delivery marks that react-icons doesn't carry — branded letter tiles. */
const LETTER: Record<string, { letter: string; color: string }> = {
  rappi: { letter: "R", color: "#FF441F" },
  didi: { letter: "D", color: "#FC4C01" },
};

export default function BrandIcon({ id, size = 28 }: { id?: string | null; size?: number }) {
  /* A row with no platform name must degrade to the neutral tile, never crash the tree —
     one bad DB row white-screening the whole Connect page is exactly the class of bug the
     harness caught here. */
  const key = (id ?? "").toLowerCase();
  const hit = MAP[key];
  if (hit) {
    const { Icon, color } = hit;
    return <Icon size={size} color={color} className="dark:brightness-125" />;
  }
  const lt = LETTER[key] ?? { letter: (key[0] ?? "?").toUpperCase(), color: "#64748B" };
  return (
    <span
      className="grid place-items-center rounded-lg font-extrabold text-white"
      style={{ width: size, height: size, background: lt.color, fontSize: size * 0.55 }}
    >
      {lt.letter}
    </span>
  );
}
