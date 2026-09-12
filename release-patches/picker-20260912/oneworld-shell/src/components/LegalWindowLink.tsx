import type { MouseEvent, ReactNode } from "react";

/** Open legal text separately so the account form and its entered values remain in place. */
export default function LegalWindowLink({ href, children }: { href: "/terms" | "/privacy" | "/onehome/terms"; children: ReactNode }) {
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const reader = window.open("about:blank", "_blank", "popup=yes,width=860,height=780,resizable=yes,scrollbars=yes");
    if (!reader) return;
    reader.opener = null;
    reader.location.replace(new URL(href, window.location.origin).href);
    event.preventDefault();
  };
  return <a href={href} target="_blank" rel="noopener noreferrer" onClick={open}
    className="font-semibold underline underline-offset-4">{children}</a>;
}
