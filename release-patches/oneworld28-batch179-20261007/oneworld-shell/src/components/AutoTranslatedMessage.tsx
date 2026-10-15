/* ── A CHAT MESSAGE IN THE READER'S LANGUAGE ───────────────────────────────────────────────────
   Lee, 9 Oct 2026: "like Uber — you write in English, and if their language is Spanish they see
   it in Spanish. That's a global change, for all the apps."

   Every incoming text message is shown in the reader's app language, translated once per message
   per language by `translate-content` (v3) and cached privately (`message_translations`). Only
   the two people in the chat can get a translation. Your OWN messages are never translated for
   you — you know what you wrote.

   THE HONEST BIT: a translated message says so ("Translated") and offers the original in one tap.
   When the message was already in your language there is no mark at all. Any failure shows the
   original text, exactly as `useAutoTranslate` does for listings. */
import { useState } from "react";
import MessageBody from "./MessageBody";
import { useAutoTranslate, tr } from "../lib/autoTranslate";
import { useI18n, W, registerCopy } from "../lib/i18n";

registerCopy({
  de: { "Translated": "Übersetzt", "Show original": "Original anzeigen", "Show translation": "Übersetzung anzeigen" },
  pt: { "Translated": "Traduzido", "Show original": "Ver original", "Show translation": "Ver tradução" },
  ru: { "Translated": "Переведено", "Show original": "Показать оригинал", "Show translation": "Показать перевод" },
  zh: { "Translated": "已翻译", "Show original": "查看原文", "Show translation": "查看译文" },
});

type Props = Parameters<typeof MessageBody>[0];

export default function AutoTranslatedMessage(props: Props) {
  const { lang } = useI18n();
  const [original, setOriginal] = useState(false);
  const eligible = !props.mine && !!props.messageId && (props.messageType ?? "text") === "text" && !!props.text?.trim();
  const t = useAutoTranslate("messages", eligible ? props.messageId : null, lang, eligible);
  const shown = eligible && t.translated && !original ? tr(t, "content", props.text) : props.text;
  return (
    <>
      <MessageBody {...props} text={shown} />
      {eligible && t.translated && (
        <button type="button" onClick={() => setOriginal(o => !o)}
          className="mt-0.5 block text-left text-[10.5px] font-semibold opacity-55 underline-offset-2 hover:underline">
          {original ? W(lang, "Show translation", "Ver traducción") : `${W(lang, "Translated", "Traducido")} · ${W(lang, "Show original", "Ver original")}`}
        </button>
      )}
    </>
  );
}
