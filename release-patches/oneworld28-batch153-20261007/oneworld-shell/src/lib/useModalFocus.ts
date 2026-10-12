import { useEffect, useRef } from "react";

/** Contains keyboard focus while allowing a later portal dialog to take focus. */
export function useModalFocus(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const panel = ref.current;
    if (!open || !panel) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const visible = (el: HTMLElement) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const controls = () => Array.from(panel.querySelectorAll<HTMLElement>(
      'button,a[href],input,select,textarea,[tabindex],video[controls],audio[controls],[contenteditable="true"]',
    )).filter(el => el.tabIndex >= 0 && !el.matches(':disabled,[inert], [inert] *') && visible(el));
    const frame = requestAnimationFrame(() => {
      if (!panel.contains(document.activeElement)) (controls()[0] ?? panel).focus({ preventScroll: true });
    });
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"],dialog[open]')).filter(visible);
      const top = dialogs[dialogs.length - 1];
      // Date/select/share sheets can be portals outside this panel. Their own keys win.
      if (top && top !== panel && !panel.contains(top)) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); close.current(); return;
      }
      if (event.key !== 'Tab') return;
      const items = controls(), first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); panel.focus(); return; }
      if (!panel.contains(document.activeElement) || document.activeElement === panel) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keydown);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);
  return ref;
}
