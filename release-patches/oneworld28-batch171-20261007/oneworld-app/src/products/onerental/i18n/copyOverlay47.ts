/* ONEWORLD overlay 47 (5 Oct 2026) — One ID Verified on the sale payments panel: the three refusals
 * when an identity check is needed. Same register as copyOverlay46.ts. */
import { registerCopy } from "@oneworld/shell";

const A = "Verify your identity once before paying. Nothing was charged.";
const B = "The agent hasn't verified their identity yet, so nothing was charged. We've told them; try again once they do.";
const C = "The seller hasn't verified their identity yet, so nothing was charged. We've told them; try again once they do.";

registerCopy({
  de: {
    [A]: "Bestätigen Sie einmal Ihre Identität, bevor Sie zahlen. Es wurde nichts belastet.",
    [B]: "Der Makler hat seine Identität noch nicht bestätigt, daher wurde nichts belastet. Wir haben ihn informiert; versuchen Sie es erneut, sobald er es getan hat.",
    [C]: "Der Verkäufer hat seine Identität noch nicht bestätigt, daher wurde nichts belastet. Wir haben ihn informiert; versuchen Sie es erneut, sobald er es getan hat.",
  },
  pt: {
    [A]: "Verifique sua identidade uma única vez antes de pagar. Nada foi cobrado.",
    [B]: "O corretor ainda não verificou a identidade, então nada foi cobrado. Já avisamos; tente novamente quando ele concluir.",
    [C]: "O vendedor ainda não verificou a identidade, então nada foi cobrado. Já avisamos; tente novamente quando ele concluir.",
  },
  ru: {
    [A]: "Перед оплатой один раз подтвердите личность. Деньги не списаны.",
    [B]: "Агент ещё не подтвердил личность, поэтому деньги не списаны. Мы сообщили ему; попробуйте снова, когда он это сделает.",
    [C]: "Продавец ещё не подтвердил личность, поэтому деньги не списаны. Мы сообщили ему; попробуйте снова, когда он это сделает.",
  },
  zh: {
    [A]: "付款前请先验证一次身份。未产生任何扣款。",
    [B]: "经纪人尚未验证身份，因此未扣款。我们已通知对方；对方完成后请再试一次。",
    [C]: "卖方尚未验证身份，因此未扣款。我们已通知对方；对方完成后请再试一次。",
  },
});
