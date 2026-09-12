import { Markdown } from '@oneworld/shell';
import { useLayoutEffect, useRef, useState } from 'react';

export type AgreementDocument = { id: string; version: string; title: string; text: string };
type Props = {
  documents: AgreementDocument[];
  locale?: string;
  onChange: (accepted: AgreementDocument[]) => void;
};

// Content and versions must be supplied by the approved legal-document source.
// This component records local review state only; it never writes consent to a server.
export default function AgreementAcceptance({ documents, locale = 'en', onChange }: Props) {
  const es = locale === 'es' || locale === 'co';
  const fr = locale === 'fr';
  const words = es ? {
    view: 'Leer', done: 'Aceptado', close: 'Cerrar', agree: 'Acepto',
    scroll: 'Desplácese hasta el final para activar «Acepto».', ready: 'Llegó al final. Ahora puede aceptar.',
  } : fr ? {
    view: 'Lire', done: 'Accepté', close: 'Fermer', agree: 'J’accepte',
    scroll: 'Faites défiler jusqu’à la fin pour activer « J’accepte ».', ready: 'Vous avez atteint la fin. Vous pouvez maintenant accepter.',
  } : {
    view: 'Read', done: 'Accepted', close: 'Close', agree: 'Agree',
    scroll: 'Scroll to the end to enable Agree.', ready: 'You have reached the end. You can now agree.',
  };
  const [open, setOpen] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [atEnd, setAtEnd] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const key = (d: AgreementDocument) => JSON.stringify([d.id, d.version, d.text]);
  const doc = documents.find(d => d.id === open);
  const documentIdentity = JSON.stringify(doc);
  const documentSet = JSON.stringify(documents);

  useLayoutEffect(() => {
    onChange(documents.filter(d => accepted.includes(key(d))));
  }, [documentSet, accepted]); // Callback identity does not invalidate reviewed documents.

  useLayoutEffect(() => {
    const modal = dialog.current;
    const content = body.current;
    if (!doc || !modal || !content) return;
    setAtEnd(false);
    modal.showModal();
    content.scrollTop = 0;
    const check = () => setAtEnd(content.scrollTop + content.clientHeight >= content.scrollHeight - 2);
    const observer = new ResizeObserver(check);
    observer.observe(content);
    check(); // Short documents are already at the bottom: no impossible scroll gate.
    return () => { observer.disconnect(); modal.close(); };
  }, [documentIdentity, locale]);

  return <section className="space-y-3">
    {documents.map(d => <div key={d.id} className="flex items-center justify-between gap-3 rounded-2xl border p-4">
      <strong>{d.title}</strong>
      {accepted.includes(key(d)) ? (
        <button type="button" onClick={() => setOpen(d.id)}
          aria-label={`${d.title}: ${words.done}`} title={words.done}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-emerald-600 bg-transparent text-xl font-black text-emerald-700 dark:border-emerald-400 dark:text-emerald-300">
          <span aria-hidden="true">✓</span>
        </button>
      ) : (
        <button type="button" className="shrink-0 underline" onClick={() => setOpen(d.id)}>{words.view}</button>
      )}
    </div>)}
    {doc && <dialog ref={dialog} aria-labelledby="agreement-title" onCancel={() => setOpen(null)}
      className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl border p-0 backdrop:bg-black/50">
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <h2 id="agreement-title" className="text-xl font-bold">{doc.title}</h2>
        <button type="button" onClick={() => setOpen(null)}>{words.close}</button>
      </div>
      <p id="agreement-instruction" role="status" className="border-b bg-brand-tint p-4 font-semibold text-brand-dark">
        {atEnd ? words.ready : words.scroll}
      </p>
      <div ref={body} tabIndex={0} aria-describedby="agreement-instruction" data-testid="agreement-body"
        style={{ maxHeight: '45dvh', overflowY: 'auto', overflowWrap: 'anywhere' }}
        className="p-4 leading-relaxed" onScroll={e => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) setAtEnd(true);
        }}><Markdown source={doc.text} /></div>
      <div className="border-t p-4">
        <button type="button" disabled={!atEnd} aria-describedby="agreement-instruction"
          className="w-full rounded-xl bg-brand-deep p-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-600"
          onClick={() => {
            if (!atEnd) return;
            setAccepted(previous => [...new Set([...previous, key(doc)])]);
            setOpen(null);
          }}>{words.agree}</button>
      </div>
    </dialog>}
  </section>;
}
