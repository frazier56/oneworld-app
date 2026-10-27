/**
 * VOICE COPY — de / pt / ru / zh for the shared microphone's new lines (overlay 48, 6 Oct 2026).
 * English and Spanish are inline at the call site; a half-translated screen is a defect.
 */
import { registerCopy } from "./i18n";

registerCopy({
  de: {
    "Writing down what you said…": "Ihre Worte werden aufgeschrieben…",
    "Part of what you said couldn't be written down. Say it again, or type it.": "Ein Teil Ihrer Worte konnte nicht aufgeschrieben werden. Sagen Sie es noch einmal oder tippen Sie es.",
  },
  pt: {
    "Writing down what you said…": "Anotando o que você disse…",
    "Part of what you said couldn't be written down. Say it again, or type it.": "Parte do que você disse não pôde ser anotada. Diga de novo ou digite.",
  },
  ru: {
    "Writing down what you said…": "Записываем сказанное…",
    "Part of what you said couldn't be written down. Say it again, or type it.": "Часть сказанного не удалось записать. Повторите или напечатайте.",
  },
  zh: {
    "Writing down what you said…": "正在记录您说的话…",
    "Part of what you said couldn't be written down. Say it again, or type it.": "您说的部分内容未能记录，请再说一遍或直接输入。",
  },
});
