import { useI18n as useShellI18n } from "@oneworld/shell";

/**
 * ONEPAY STRINGS — en + es, OneAgent's pattern. The shell's picker is the only picker; `co` is
 * Spanish. de / ru / zh / pt fall back to English until written. No English hard-coded in JSX.
 */
const dict = {
  en: {
    loading: "Loading…", signInFirst: "Sign in to use OnePay.", retry: "Try again",
    /* setup */
    setupTitle: "Set up your business", setupBody: "OnePay records every charge against a business. Name it once; you can add staff, a catalog and devices afterwards.",
    bizName: "Business name", bizCity: "City", bizLegal: "Legal name (optional)", bizTaxId: "NIT / tax ID (optional)", create: "Create business",
    /* overview */
    today: "Today", sales: "Sales", refunds: "Refunds", net: "Net", count: "charges", pending: "in progress",
    dayClosed: "Day closed", dayOpen: "Day open", newCharge: "New charge", seeActivity: "See activity", closeDay: "Close the day",
    byMethod: "By method", noSalesYet: "No charges yet today.", tapNotReady: "Card tap on this phone is not switched on for this business yet. Cash and transfers work now.",
    tapReady: "Card tap on this phone is on.",
    /* charge */
    chargeTitle: "Charge", amount: "Amount", addItem: "Add from catalog", customLine: "Custom amount", description: "Description (optional)",
    qty: "Qty", discount: "Discount", tip: "Tip", customer: "Customer name (optional)", note: "Note (optional)", total: "Total", subtotal: "Subtotal",
    review: "Review charge", howPaid: "How is the customer paying?", cash: "Cash", transfer: "Bank transfer / Nequi", link: "Payment link", qr: "QR", tap: "Tap card on this phone",
    transferRef: "Transfer reference (optional)", confirmCash: "Cash received", startTransfer: "Waiting for transfer", startTap: "Ready to tap",
    paid: "Paid", failed: "Failed", unresolved: "Unresolved", voided: "Cancelled", pendingState: "Pending",
    chargeDone: "Charged", receipt: "Receipt", another: "New charge", cancelAttempt: "Cancel this payment", confirmTransfer: "Money arrived — confirm",
    transferHint: "Confirm only after the transfer shows in your account. Only an owner or manager can confirm.",
    emptyLines: "Add an amount or an item to continue.", methodUnavailable: "Not available yet for this business",
    /* activity */
    activityTitle: "Activity", noActivity: "Nothing recorded yet.", loadMore: "Load more", order: "Charge", refund: "Refund", refundAmount: "Refund amount", refundReason: "Reason (optional)", doRefund: "Record refund",
    refundHint: "Cash and transfer refunds are recorded here after you hand the money back. Card refunds arrive with the provider.",
    void: "Void this charge", status: "Status", method: "Method", reference: "Reference", when: "When",
    /* closeout */
    closeoutTitle: "Closeout", closeoutBody: "Close the day once every payment in progress is resolved. The totals are frozen and kept.", closed: "Closed", closeNow: "Close today", pendingBlock: "Resolve the payments in progress first.",
    /* catalog */
    catalogTitle: "Catalog", catalogBody: "Items you charge often. Price in pesos.", itemName: "Item", price: "Price", save: "Save", add: "Add item", inactive: "Hidden", active: "Shown",
    /* staff */
    staffTitle: "Staff", staffBody: "People who can charge for this business. Managers can confirm transfers, refund and close the day.", role: "Role", owner: "Owner", manager: "Manager", staffRole: "Staff", addStaff: "Add by One ID", userIdHint: "Paste the person's One ID (from their profile).", remove: "Remove", restore: "Restore",
    /* devices */
    devicesTitle: "Devices", devicesBody: "Phones registered to charge for this business. Card tap is switched on per device by the payment provider — it cannot be toggled here.", registerThis: "Register this device", deviceLabel: "Device name", tapCapable: "Tap-capable", notTap: "Cash & transfer only",
    /* receipt */
    receiptTitle: "Receipt", issued: "Issued", share: "Share", copyLink: "Copy",
    /* profile slots */
    tileCharge: "Charge", tileActivity: "Activity", tileCloseout: "Closeout", statSales: "Sales today", statCharges: "Charges", statPending: "In progress",
    errGeneric: "Something went wrong. Nothing was charged.",
  },
  es: {
    loading: "Cargando…", signInFirst: "Inicie sesión para usar OnePay.", retry: "Intentar de nuevo",
    setupTitle: "Configure su negocio", setupBody: "OnePay registra cada cobro a nombre de un negocio. Póngale nombre una vez; luego puede agregar equipo, catálogo y dispositivos.",
    bizName: "Nombre del negocio", bizCity: "Ciudad", bizLegal: "Razón social (opcional)", bizTaxId: "NIT (opcional)", create: "Crear negocio",
    today: "Hoy", sales: "Ventas", refunds: "Reembolsos", net: "Neto", count: "cobros", pending: "en curso",
    dayClosed: "Día cerrado", dayOpen: "Día abierto", newCharge: "Nuevo cobro", seeActivity: "Ver actividad", closeDay: "Cerrar el día",
    byMethod: "Por método", noSalesYet: "Aún no hay cobros hoy.", tapNotReady: "El pago con tarjeta en este teléfono aún no está activo para este negocio. Efectivo y transferencias funcionan ya.",
    tapReady: "El pago con tarjeta en este teléfono está activo.",
    chargeTitle: "Cobrar", amount: "Monto", addItem: "Agregar del catálogo", customLine: "Monto libre", description: "Descripción (opcional)",
    qty: "Cant.", discount: "Descuento", tip: "Propina", customer: "Nombre del cliente (opcional)", note: "Nota (opcional)", total: "Total", subtotal: "Subtotal",
    review: "Revisar cobro", howPaid: "¿Cómo paga el cliente?", cash: "Efectivo", transfer: "Transferencia / Nequi", link: "Enlace de pago", qr: "QR", tap: "Tarjeta en este teléfono",
    transferRef: "Referencia de la transferencia (opcional)", confirmCash: "Efectivo recibido", startTransfer: "Esperando la transferencia", startTap: "Listo para acercar la tarjeta",
    paid: "Pagado", failed: "Fallido", unresolved: "Sin resolver", voided: "Cancelado", pendingState: "Pendiente",
    chargeDone: "Cobrado", receipt: "Recibo", another: "Nuevo cobro", cancelAttempt: "Cancelar este pago", confirmTransfer: "Llegó el dinero — confirmar",
    transferHint: "Confirme solo cuando la transferencia aparezca en su cuenta. Solo un dueño o gerente puede confirmar.",
    emptyLines: "Agregue un monto o un artículo para continuar.", methodUnavailable: "Aún no disponible para este negocio",
    activityTitle: "Actividad", noActivity: "Nada registrado todavía.", loadMore: "Cargar más", order: "Cobro", refund: "Reembolso", refundAmount: "Monto a reembolsar", refundReason: "Motivo (opcional)", doRefund: "Registrar reembolso",
    refundHint: "Los reembolsos en efectivo y transferencia se registran aquí después de devolver el dinero. Los de tarjeta llegan con el proveedor.",
    void: "Anular este cobro", status: "Estado", method: "Método", reference: "Referencia", when: "Cuándo",
    closeoutTitle: "Cierre", closeoutBody: "Cierre el día cuando todos los pagos en curso estén resueltos. Los totales quedan congelados y guardados.", closed: "Cerrado", closeNow: "Cerrar hoy", pendingBlock: "Resuelva primero los pagos en curso.",
    catalogTitle: "Catálogo", catalogBody: "Artículos que cobra con frecuencia. Precio en pesos.", itemName: "Artículo", price: "Precio", save: "Guardar", add: "Agregar artículo", inactive: "Oculto", active: "Visible",
    staffTitle: "Equipo", staffBody: "Personas que pueden cobrar para este negocio. Los gerentes pueden confirmar transferencias, reembolsar y cerrar el día.", role: "Rol", owner: "Dueño", manager: "Gerente", staffRole: "Equipo", addStaff: "Agregar por One ID", userIdHint: "Pegue el One ID de la persona (de su perfil).", remove: "Quitar", restore: "Restaurar",
    devicesTitle: "Dispositivos", devicesBody: "Teléfonos registrados para cobrar en este negocio. El pago con tarjeta lo activa el proveedor por dispositivo; no se puede activar aquí.", registerThis: "Registrar este dispositivo", deviceLabel: "Nombre del dispositivo", tapCapable: "Acepta tarjeta", notTap: "Solo efectivo y transferencia",
    receiptTitle: "Recibo", issued: "Emitido", share: "Compartir", copyLink: "Copiar",
    tileCharge: "Cobrar", tileActivity: "Actividad", tileCloseout: "Cierre", statSales: "Ventas hoy", statCharges: "Cobros", statPending: "En curso",
    errGeneric: "Algo salió mal. No se cobró nada.",
  },
} as const;

export type PayKey = keyof typeof dict.en;

export function useT() {
  const { lang: shellLang } = useShellI18n();
  const lang: "en" | "es" = shellLang === "es" || shellLang === "co" ? "es" : "en";
  const t = (k: PayKey) => (dict[lang] as Record<PayKey, string>)[k] ?? dict.en[k];
  return { lang, t };
}
export const dateLocale = (lang: "en" | "es") => (lang === "es" ? "es-CO" : "en-US");
