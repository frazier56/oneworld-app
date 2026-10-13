/** Display the server decision; never infer currency eligibility from listing prices. */
export function currencyRecovery(lang: string, host = false): string {
  const copy: Record<string, string> = {
    en: 'This Colombian residential request requires COP. Do not send or collect more money. Contact the host in Messages to resolve the currency before proceeding. Existing payment records are unchanged; this check does not issue a refund or convert money.',
    es: 'Esta solicitud de vivienda colombiana requiere COP. No envíe ni cobre más dinero. Contacte al anfitrión en Mensajes para resolver la moneda antes de continuar. Los registros de pago no cambian; esta verificación no emite reembolsos ni convierte dinero.',
    pt: 'Esta solicitação residencial colombiana exige COP. Não envie nem cobre mais dinheiro. Contate o anfitrião em Mensagens para resolver a moeda antes de continuar. Os registros de pagamento permanecem iguais; esta verificação não emite reembolsos nem converte dinheiro.',
    de: 'Diese kolumbianische Wohnraumanfrage erfordert COP. Senden oder verlangen Sie kein weiteres Geld. Klären Sie die Währung über Nachrichten mit dem Gastgeber, bevor Sie fortfahren. Zahlungsaufzeichnungen bleiben unverändert; diese Prüfung veranlasst keine Erstattung oder Umrechnung.',
    ru: 'Для этой заявки на жильё в Колумбии требуется COP. Не отправляйте и не принимайте дополнительные деньги. Свяжитесь с хозяином через сообщения, чтобы уточнить валюту до продолжения. Записи платежей не меняются; эта проверка не выполняет возврат или конвертацию.',
    zh: '此哥伦比亚住宅申请须使用 COP。请勿继续付款或收款。请通过消息联系房东，先解决币种问题再继续。付款记录保持不变；此检查不会退款或兑换资金。',
  };
  const hostCopy: Record<string, string> = {
    en: 'As host, review the listing currency and agree with the tenant in Messages how to resolve this request. Changing the listing will not convert this existing request.',
    es: 'Como anfitrión, revise la moneda del anuncio y acuerde con el inquilino en Mensajes cómo resolver esta solicitud. Cambiar el anuncio no convierte esta solicitud existente.',
    pt: 'Como anfitrião, revise a moeda do anúncio e combine com o inquilino em Mensagens como resolver esta solicitação. Alterar o anúncio não converte esta solicitação existente.',
    de: 'Prüfen Sie als Gastgeber die Währung des Inserats und vereinbaren Sie mit dem Mieter über Nachrichten eine Lösung. Eine Änderung des Inserats rechnet diese bestehende Anfrage nicht um.',
    ru: 'Как хозяин, проверьте валюту объявления и согласуйте решение с жильцом в сообщениях. Изменение объявления не конвертирует существующую заявку.',
    zh: '作为房东，请检查房源币种，并通过消息与租客商定解决方式。修改房源不会转换此现有申请的币种。',
  };
  const key = lang === 'co' ? 'es' : lang;
  const renterOnly: Record<string, string> = {
    en: 'Contact the host in Messages to resolve the currency before proceeding. ',
    es: 'Contacte al anfitrión en Mensajes para resolver la moneda antes de continuar. ',
    pt: 'Contate o anfitrião em Mensagens para resolver a moeda antes de continuar. ',
    de: 'Klären Sie die Währung über Nachrichten mit dem Gastgeber, bevor Sie fortfahren. ',
    ru: 'Свяжитесь с хозяином через сообщения, чтобы уточнить валюту до продолжения. ',
    zh: '请通过消息联系房东，先解决币种问题再继续。',
  };
  const base = copy[key] ?? copy.en;
  return host ? base.replace(renterOnly[key] ?? renterOnly.en, '') + ' ' + (hostCopy[key] ?? hostCopy.en) : base;
}
