const ONEHOME_SUPABASE_URL = "https://wseblryyqxawvbjmylbo.supabase.co";
const ONEHOME_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZWJscnl5cXhhd3Ziam15bGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU4NjksImV4cCI6MjA5MzUyMTg2OX0.y2yfMwSC_eh_jzI5eXsp6qD5zkl0OICtESV070EhRQM";
const REVIEW_API = `${ONEHOME_SUPABASE_URL}/functions/v1/listing-review`;
const INSPECTION_API = `${ONEHOME_SUPABASE_URL}/functions/v1/rental-inspection`;
const PLATFORM_TERMS_VERSION = "oneworld-platform-owner-review-2026-09-01";
const PROPERTY_TERMS_VERSION = "onehome-property-owner-review-draft-2026-09-01-v3";
const CLAIM_TOKEN = location.pathname.match(/^\/rentals\/review\/([0-9a-f]{48})\/?$/i)?.[1]?.toLowerCase() || "";
const FIXTURE_MODE = new URLSearchParams(location.search).get("onehomeQaFixture") === "owner-media";

const termsState = window.__onehomeOwnerTerms || {
  platform: false,
  property: false,
  platformRead: false,
  propertyRead: false,
  existingSaved: false,
  busy: false,
};
window.__onehomeOwnerTerms = termsState;

function currentLocale() {
  const stored = localStorage.getItem("oneworld-lang");
  const clean = String(stored || "").replace(/^"|"$/g, "");
  if (["en", "co", "es", "de", "ru", "zh", "pt"].includes(clean)) return clean;
  const html = document.documentElement.lang?.toLowerCase() || "en";
  return html.startsWith("es") ? "co" : html.split("-")[0];
}

function tr(english, spanish) {
  return window.__onehomeFlowTranslate?.(currentLocale(), english, spanish) ||
    ((currentLocale() === "co" || currentLocale() === "es") ? spanish : english);
}

function textMatches(element, pattern) {
  return pattern.test((element?.textContent || "").trim());
}

function fieldValue(labelPattern) {
  const labels = [...document.querySelectorAll("label")];
  const label = labels.find((candidate) => textMatches(candidate, labelPattern));
  return label?.querySelector("input")?.value?.trim() || "";
}

function termDocument(kind) {
  if (kind === "platform") return `
    <h2>${tr("OneHome Terms", "Términos de OneHome")}</h2>
    <p>${tr("OneHome provides the account, electronic records, messaging, payment-record status and support tools. OneHome is not the property owner and does not supply the home.", "OneHome proporciona la cuenta, los registros electrónicos, la mensajería, el estado de los registros de pago y las herramientas de soporte. OneHome no es el propietario ni suministra el inmueble.")}</p>
    <p>${tr("Your OneHome consent is recorded separately from the property owner's supplemental terms.", "Su consentimiento a OneHome se registra por separado de los términos adicionales del propietario.")}</p>
    <p>${tr("Accepting these terms does not sign the lease or confirm a payment.", "Aceptar estos términos no firma el contrato ni confirma un pago.")}</p>
    <p class="ohqa-pending-note">${tr("This review version includes only the approved operational summary currently available. Final legal copy covering privacy, electronic records and signatures, messaging, fees, support and disputes still requires legal approval.", "Esta versión de revisión incluye únicamente el resumen operativo aprobado que está disponible actualmente. El texto legal final sobre privacidad, registros y firmas electrónicos, mensajería, tarifas, soporte y disputas todavía requiere aprobación legal.")}</p>`;
  return `
    <h2>${tr("Property Owner Supplemental Terms", "Términos adicionales del propietario")}</h2>
    <h3>${tr("Current listing terms", "Términos actuales del inmueble")}</h3>
    <ul>
      <li><strong>9,000,000 COP</strong> ${tr("for each monthly rental period.", "por cada período mensual de arriendo.")}</li>
      <li>${tr("A separate, one-time 300,000 COP cleaning charge is due when the lease starts.", "Se debe pagar un cargo único y separado de limpieza de 300.000 COP cuando comience el contrato.")}</li>
      <li>${tr("No security deposit. The start date and tenant identity are added when the tenant packet is prepared.", "No hay depósito de garantía. La fecha de inicio y la identidad del inquilino se agregan cuando se prepare el paquete del inquilino.")}</li>
    </ul>
    <h3>${tr("Property rules carried forward from the prior five-page contract", "Reglas del inmueble conservadas del contrato anterior de cinco páginas")}</h3>
    <ul>
      <li>${tr("Residential, lawful use only.", "Uso residencial y lícito únicamente.")}</li>
      <li>${tr("The furnished home and furniture are returned in the condition documented at move-in, allowing for ordinary wear.", "El inmueble amoblado y sus muebles se devuelven en el estado documentado al ingreso, salvo el desgaste normal.")}</li>
      <li>${tr("The owner handles necessary or structural repairs. The tenant handles damage caused by the tenant or guests and reports owner repairs in writing.", "El propietario se encarga de las reparaciones necesarias o estructurales. El inquilino responde por los daños causados por él o sus invitados y reporta por escrito las reparaciones que correspondan al propietario.")}</li>
      <li>${tr("Water, electricity, gas, internet, television and building administration are included. Extra services requested by the tenant are the tenant's responsibility.", "Se incluyen agua, electricidad, gas, internet, televisión y administración del edificio. Los servicios adicionales solicitados por el inquilino son su responsabilidad.")}</li>
      <li>${tr("No alterations, assignment or subletting without the owner's prior written approval.", "No se permiten modificaciones, cesión ni subarriendo sin la autorización previa y escrita del propietario.")}</li>
      <li>${tr("Temporary travel is not treated as abandonment while rent is current and personal belongings remain.", "Un viaje temporal no se considera abandono mientras el arriendo esté al día y permanezcan las pertenencias personales.")}</li>
    </ul>
    <p class="ohqa-pending-note"><strong>${tr("Not accepted yet:", "Aún no aceptado:")}</strong> ${tr("cancellation and notice periods, annual rent adjustments, late-payment interest, penalties and collection costs, repainting beyond ordinary wear, owner entry after alleged abandonment, support-animal wording, and any deposit or replacement security. These items require a separate final decision before the lease can be signed.", "los períodos de cancelación y aviso, los ajustes anuales del canon, los intereses por mora, las sanciones y costos de cobro, la pintura más allá del desgaste normal, el ingreso del propietario después de un supuesto abandono, la redacción sobre animales de apoyo y cualquier depósito o garantía sustitutiva. Estos puntos requieren una decisión final separada antes de firmar el contrato.")}</p>
    <p>${tr("This acknowledgment records review only. It stays separate from the OneHome Terms and does not sign the final lease.", "Este reconocimiento solo registra la revisión. Permanece separado de los Términos de OneHome y no firma el contrato final.")}</p>`;
}

function openTermsDocument(kind) {
  document.querySelector("#ohqa-document-modal")?.remove();
  const modal = document.createElement("div");
  modal.id = "ohqa-document-modal";
  modal.className = "ohqa-document-modal";
  modal.innerHTML = `<div class="ohqa-document-card" role="dialog" aria-modal="true" aria-labelledby="ohqa-document-title">
    <button type="button" class="ohqa-document-close" aria-label="${tr("Close", "Cerrar")}">×</button>
    <div class="ohqa-document-scroll" tabindex="0">${termDocument(kind)}<div class="ohqa-document-end">${tr("End of document", "Fin del documento")}</div></div>
    <p class="ohqa-read-status">${tr("Scroll to the bottom to unlock this acknowledgment.", "Desplácese hasta el final para habilitar este reconocimiento.")}</p>
    <button type="button" class="ohqa-document-done" disabled>${tr("Return to the form", "Volver al formulario")}</button>
  </div>`;
  document.body.append(modal);
  const scroller = modal.querySelector(".ohqa-document-scroll");
  const done = modal.querySelector(".ohqa-document-done");
  const status = modal.querySelector(".ohqa-read-status");
  const markRead = () => {
    if (scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 8) return;
    termsState[`${kind}Read`] = true;
    done.disabled = false;
    status.textContent = tr("Document read. Return to the form to select the acknowledgment.", "Documento leído. Vuelva al formulario para seleccionar el reconocimiento.");
  };
  scroller.addEventListener("scroll", markRead);
  scroller.addEventListener("wheel", markRead);
  scroller.addEventListener("touchend", markRead);
  const close = () => { modal.remove(); refreshTermsPanel(); };
  modal.querySelector(".ohqa-document-close").addEventListener("click", close);
  done.addEventListener("click", close);
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  scroller.focus();
}

function termsPanel() {
  const panel = document.createElement("section");
  panel.id = "onehome-separate-terms";
  panel.className = "ohqa-terms";
  panel.dataset.locale = currentLocale();
  panel.innerHTML = `
    <div class="ohqa-eyebrow">${tr("Two separate acknowledgments", "Dos reconocimientos separados")}</div>
    <h3>${tr("Read each document separately", "Lea cada documento por separado")}</h3>
    <p class="ohqa-muted">${tr("Each consent is recorded independently. Opening or accepting one never accepts the other.", "Cada consentimiento se registra de forma independiente. Abrir o aceptar uno nunca acepta el otro.")}</p>
    <button type="button" class="ohqa-document-open" data-document="platform"><span>1. ${tr("OneHome Terms", "Términos de OneHome")}</span><strong>${termsState.platformRead ? tr("Read", "Leído") : tr("Open and read", "Abrir y leer")}</strong></button>
    <label class="ohqa-check">
      <input id="ohqa-platform-terms" type="checkbox" ${termsState.platformRead ? "" : "disabled"}>
      <span>${tr("I agree to the OneHome Terms.", "Acepto los Términos de OneHome.")}</span>
    </label>
    <button type="button" class="ohqa-document-open" data-document="property"><span>2. ${tr("Property Owner Supplemental Terms", "Términos adicionales del propietario")}</span><strong>${termsState.propertyRead ? tr("Read", "Leído") : tr("Open and read", "Abrir y leer")}</strong></button>
    <label class="ohqa-check">
      <input id="ohqa-property-terms" type="checkbox" ${termsState.propertyRead ? "" : "disabled"}>
      <span>${tr("I acknowledge the Property Owner Supplemental Terms.", "Reconozco los Términos adicionales del propietario.")}</span>
    </label>
    <p class="ohqa-terms-error" role="alert" hidden>${tr("Read both documents and select both separate acknowledgments before continuing.", "Lea ambos documentos y seleccione los dos reconocimientos por separado antes de continuar.")}</p>`;
  const platform = panel.querySelector("#ohqa-platform-terms");
  const property = panel.querySelector("#ohqa-property-terms");
  platform.checked = termsState.platform;
  property.checked = termsState.property;
  platform.addEventListener("change", () => {
    termsState.platform = platform.checked;
    panel.querySelector(".ohqa-terms-error").hidden = true;
  });
  property.addEventListener("change", () => {
    termsState.property = property.checked;
    panel.querySelector(".ohqa-terms-error").hidden = true;
  });
  panel.querySelectorAll("[data-document]").forEach((button) => button.addEventListener("click", () => openTermsDocument(button.dataset.document)));
  return panel;
}

function refreshTermsPanel() {
  const existing = document.querySelector("#onehome-separate-terms");
  if (!existing) return mountTerms();
  const parent = existing.parentElement;
  const next = existing.nextSibling;
  existing.remove();
  parent.insertBefore(termsPanel(), next);
}

function mountTerms() {
  if (!CLAIM_TOKEN) return;
  const existing = document.querySelector("#onehome-separate-terms");
  if (existing) {
    if (existing.dataset.locale !== currentLocale()) refreshTermsPanel();
    return;
  }
  const accountEmail = document.querySelector('input[type="email"][autocomplete="email"]');
  const nameInput = document.querySelector('input[autocomplete="name"]');
  if (!nameInput) return;
  if (accountEmail) {
    const formArea = accountEmail.closest("div.mt-4") || accountEmail.parentElement?.parentElement;
    const createButton = formArea?.parentElement?.querySelector("button.btn-primary");
    if (createButton) createButton.parentElement.insertBefore(termsPanel(), createButton);
    return;
  }
  const cardBody = nameInput.closest("div.space-y-3") || nameInput.parentElement?.parentElement;
  const label = nameInput.closest("label");
  if (cardBody && label) cardBody.insertBefore(termsPanel(), label);
}

function showTermsError(message) {
  const panel = document.querySelector("#onehome-separate-terms");
  const error = panel?.querySelector(".ohqa-terms-error");
  if (error) {
    error.textContent = message || tr("Read both documents and select both separate acknowledgments before continuing.", "Lea ambos documentos y seleccione los dos reconocimientos por separado antes de continuar.");
    error.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

async function acknowledgeExistingApproval(name) {
  if (termsState.existingSaved) return true;
  termsState.busy = true;
  try {
    const response = await fetch(REVIEW_API, {
      method: "POST",
      headers: { apikey: ONEHOME_ANON_KEY, Authorization: `Bearer ${ONEHOME_ANON_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        action: "acknowledge_existing_approval",
        t: CLAIM_TOKEN,
        name,
        platform_terms_accepted: termsState.platform,
        property_terms_accepted: termsState.property,
        platform_terms_version: PLATFORM_TERMS_VERSION,
        property_terms_version: PROPERTY_TERMS_VERSION,
        locale: currentLocale(),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || tr("The acknowledgments could not be saved.", "No se pudieron guardar los reconocimientos."));
    termsState.existingSaved = true;
    return true;
  } catch (error) {
    showTermsError(error?.message || String(error));
    return false;
  } finally {
    termsState.busy = false;
  }
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest?.("button");
  if (!button || !CLAIM_TOKEN) return;
  const label = (button.textContent || "").trim();
  const accountArea = button.parentElement?.querySelector?.('input[type="email"][autocomplete="email"]');
  const reviewArea = button.closest("section")?.querySelector?.('input[autocomplete="name"]');
  const isCreate = !!accountArea && button.classList.contains("btn-primary");
  const isReviewDecision = !!reviewArea && button.classList.contains("btn-primary");
  if (!isCreate && !isReviewDecision) return;
  if (!termsState.platform || !termsState.property) {
    event.preventDefault();
    event.stopImmediatePropagation();
    showTermsError();
    return;
  }
  if (isCreate && !termsState.existingSaved) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (termsState.busy) return;
    const name = document.querySelector('input[autocomplete="name"]')?.value?.trim() || "";
    if (!name) {
      showTermsError(tr("Add your full name before saving the acknowledgments.", "Agregue su nombre completo antes de guardar los reconocimientos."));
      return;
    }
    const saved = await acknowledgeExistingApproval(name);
    if (saved) button.click();
  }
}, true);

const flowTextOriginal = new WeakMap();
const flowAttributeOriginal = new WeakMap();
function translateReviewFlow(root = document.body) {
  const locale = currentLocale();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest("#onehome-separate-terms,#ohqa-document-modal,#onehome-owner-media")) continue;
    if (!flowTextOriginal.has(node)) flowTextOriginal.set(node, node.nodeValue);
    const original = flowTextOriginal.get(node);
    const trimmed = original.trim();
    if (!trimmed) continue;
    const translated = window.__onehomeFlowTranslate?.(locale, trimmed, trimmed) || trimmed;
    const leading = original.match(/^\s*/)?.[0] || "";
    const trailing = original.match(/\s*$/)?.[0] || "";
    node.nodeValue = `${leading}${translated}${trailing}`;
  }
  root.querySelectorAll?.("[placeholder],[aria-label],[title]").forEach((element) => {
    let originals = flowAttributeOriginal.get(element);
    if (!originals) { originals = {}; flowAttributeOriginal.set(element, originals); }
    for (const name of ["placeholder", "aria-label", "title"]) {
      if (!element.hasAttribute(name)) continue;
      if (!(name in originals)) originals[name] = element.getAttribute(name);
      element.setAttribute(name, window.__onehomeFlowTranslate?.(locale, originals[name], originals[name]) || originals[name]);
    }
  });
}

const PHONE_COUNTRIES = [
  ["CO", "🇨🇴", "+57"], ["US", "🇺🇸", "+1"], ["MX", "🇲🇽", "+52"], ["AR", "🇦🇷", "+54"],
  ["PE", "🇵🇪", "+51"], ["CL", "🇨🇱", "+56"], ["EC", "🇪🇨", "+593"], ["VE", "🇻🇪", "+58"],
  ["BR", "🇧🇷", "+55"], ["PA", "🇵🇦", "+507"], ["CR", "🇨🇷", "+506"], ["GT", "🇬🇹", "+502"],
  ["DO", "🇩🇴", "+1"], ["ES", "🇪🇸", "+34"], ["CA", "🇨🇦", "+1"], ["GB", "🇬🇧", "+44"],
  ["DE", "🇩🇪", "+49"], ["FR", "🇫🇷", "+33"], ["IT", "🇮🇹", "+39"], ["PT", "🇵🇹", "+351"],
  ["RU", "🇷🇺", "+7"], ["CN", "🇨🇳", "+86"], ["IN", "🇮🇳", "+91"]
];

function setReactInput(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function mountCountryPhone() {
  const source = document.querySelector('input[type="tel"][autocomplete="tel"]');
  if (!source || source.dataset.ohqaPhone === "true") return;
  source.dataset.ohqaPhone = "true";
  source.classList.add("ohqa-phone-source");
  source.setAttribute("aria-hidden", "true");
  source.tabIndex = -1;
  const localeDefault = { co: "CO", es: "ES", de: "DE", ru: "RU", zh: "CN", pt: "BR", en: "US" }[currentLocale()] || "US";
  const wrap = document.createElement("div");
  wrap.className = "ohqa-phone-field";
  wrap.innerHTML = `<select aria-label="${tr("Country calling code", "Código de país")}">${PHONE_COUNTRIES.map(([iso, flag, dial]) => `<option value="${iso}" ${iso === localeDefault ? "selected" : ""}>${flag} ${dial}</option>`).join("")}</select><input type="tel" inputmode="tel" autocomplete="tel-national" aria-label="${tr("National phone number", "Número de teléfono nacional")}">`;
  source.insertAdjacentElement("afterend", wrap);
  const select = wrap.querySelector("select");
  const national = wrap.querySelector("input");
  const sync = () => {
    const dial = PHONE_COUNTRIES.find(([iso]) => iso === select.value)?.[2] || "+1";
    const digits = national.value.replace(/\D/g, "").slice(0, 15);
    national.value = digits;
    setReactInput(source, digits ? `${dial}${digits}` : "");
  };
  select.addEventListener("change", sync);
  national.addEventListener("input", sync);
}

function accessToken() {
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!/^sb-[a-z0-9]+-auth-token$/i.test(key || "")) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      const token = parsed?.access_token || parsed?.currentSession?.access_token;
      if (token) return token;
    } catch { /* ignore a different app's storage value */ }
  }
  return "";
}

async function ownerApi(action, payload = {}) {
  const token = accessToken();
  if (!token) throw new Error("Sign in to manage the walkthrough photos.");
  const response = await fetch(INSPECTION_API, {
    method: "POST",
    headers: { apikey: ONEHOME_ANON_KEY, Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ action, owner_token: CLAIM_TOKEN, ...payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "The walkthrough could not be updated.");
  return result;
}

function fixturePacket() {
  const fixtureCount = Math.max(4, Math.min(55, Number(new URLSearchParams(location.search).get("fixtureCount") || 4)));
  const rooms = ["Living room", "Kitchen", "Primary bedroom", "Bathroom", "Bedroom 2", "Balcony", "Hallway"];
  const colors = ["#4d8f8a", "#92735b", "#667a91", "#8b6f87", "#6f886b", "#837554", "#5d7685"];
  const makeItem = (id, ordinal, room, caption, color) => ({
    id, ordinal, room, host_note: caption, original_name: `fixture-${ordinal}.jpg`,
    mime_type: "image/jpeg", byte_size: 2400000 + ordinal * 170000, upload_state: "ready",
    preview_url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="48%" text-anchor="middle" font-family="Arial" font-size="48" fill="white">${room}</text><text x="50%" y="58%" text-anchor="middle" font-family="Arial" font-size="26" fill="white">Photo ${ordinal}</text></svg>`)}`,
  });
  return {
    property_title: "OneHome Safe QA — Listing 10518",
    contract_id: "11111111-1111-4111-8111-111111111111",
    claim_id: "22222222-2222-4222-8222-222222222222",
    inspection_id: "33333333-3333-4333-8333-333333333333",
    inspection_state: "draft",
    listing_no: 10518,
    qa_reset_allowed: true,
    inspection: { id: "33333333-3333-4333-8333-333333333333", state: "draft", round: 1 },
    upload: { max_file_bytes: 26214400, max_items: 100, max_queue_bytes: 524288000, concurrency: 3, video_supported: false,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"], path_prefix: "fixture/" },
    items: Array.from({ length: fixtureCount }, (_, index) => {
      const ordinal = index + 1;
      const room = rooms[index % rooms.length];
      return makeItem(`${String(ordinal).padStart(8, "0")}-1111-4111-8111-${String(ordinal).padStart(12, "0")}`,
        ordinal, room, ordinal === 1 ? "Wide view from the entry" : `${room} condition photo ${ordinal}`, colors[index % colors.length]);
    }),
  };
}

class OwnerInspectionUploader {
  constructor(host, packet) {
    this.host = host;
    this.packet = packet;
    this.queue = [];
    this.active = 0;
    this.message = "";
    this.error = "";
    this.dragId = null;
    if (FIXTURE_MODE) {
      this.queue = [
        { clientId: crypto.randomUUID(), file: { name: "balcony-01.jpg", size: 4600000, type: "image/jpeg" }, status: "uploading", progress: 68, room: "Balcony", caption: "Railing and floor" },
        { clientId: crypto.randomUUID(), file: { name: "hallway-02.jpg", size: 3200000, type: "image/jpeg" }, status: "failed", progress: 41, room: "Hallway", caption: "", error: "Connection interrupted — ready to retry" },
        { clientId: crypto.randomUUID(), file: { name: "bedroom-03.webp", size: 2100000, type: "image/webp" }, status: "pending", progress: 0, room: "Bedroom 2", caption: "Closet doors" },
      ];
    }
    this.render();
  }

  get editable() { return this.packet.inspection?.state === "draft"; }
  get unsettled() { return this.queue.some((entry) => ["pending", "uploading", "failed"].includes(entry.status)); }

  render() {
    const items = this.packet.items || [];
    const ready = items.length;
    const totalBytes = items.reduce((sum, item) => sum + Number(item.byte_size || 0), 0);
    const queueMarkup = this.queue.map((entry) => `
      <article class="ohqa-queue-item" data-client-id="${entry.clientId}">
        <div class="ohqa-file-row"><strong>${escapeHtml(entry.file.name)}</strong><span>${formatBytes(entry.file.size)}</span></div>
        <div class="ohqa-progress" aria-label="${entry.progress}% uploaded"><span style="width:${entry.progress}%"></span></div>
        <div class="ohqa-file-row"><span class="ohqa-status ohqa-${entry.status}">${statusText(entry)}</span>
          <span class="ohqa-actions">${entry.status === "failed" ? '<button data-act="retry">Retry</button>' : ''}${["pending", "uploading"].includes(entry.status) ? '<button data-act="cancel">Cancel</button>' : ''}</span></div>
        <div class="ohqa-fields"><input data-field="room" value="${escapeAttr(entry.room || "")}" placeholder="Room"><input data-field="caption" value="${escapeAttr(entry.caption || "")}" placeholder="Caption (optional)"></div>
      </article>`).join("");
    const itemMarkup = items.map((item, index) => `
      <article class="ohqa-media-card" draggable="${this.editable}" data-item-id="${item.id}">
        <div class="ohqa-thumb">${item.preview_url ? `<img src="${escapeAttr(item.preview_url)}" alt="${escapeAttr(item.host_note || `Walkthrough photo ${index + 1}`)}">` : '<span>Preview unavailable</span>'}</div>
        <div class="ohqa-media-body">
          <div class="ohqa-order"><strong>${index + 1} / ${items.length}</strong><span>${formatBytes(item.byte_size)}</span></div>
          <div class="ohqa-fields"><input data-field="saved-room" value="${escapeAttr(item.room || "")}" placeholder="Room" ${this.editable ? "" : "disabled"}><input data-field="saved-caption" value="${escapeAttr(item.host_note || "")}" placeholder="Caption (optional)" ${this.editable ? "" : "disabled"}></div>
          ${this.editable ? `<div class="ohqa-item-actions"><button data-act="up" ${index === 0 ? "disabled" : ""}>↑ Earlier</button><button data-act="down" ${index === items.length - 1 ? "disabled" : ""}>↓ Later</button><button data-act="save">Save</button><button class="ohqa-danger-link" data-act="delete">Remove</button></div>` : '<p class="ohqa-frozen">Frozen in the tenant evidence packet</p>'}
        </div>
      </article>`).join("");
    this.host.innerHTML = `
      <section class="ohqa-uploader" aria-labelledby="ohqa-uploader-title">
        <div class="ohqa-uploader-head"><div><div class="ohqa-eyebrow">Move-in inspection · Round ${this.packet.inspection?.round || 1}</div><h2 id="ohqa-uploader-title">Organize the walkthrough photos</h2></div><span class="ohqa-count">${ready} ready</span></div>
        <p class="ohqa-muted">Built for 50+ ordered photos. Add room names and captions, check the complete packet, then send it to the tenant.</p>
        <div class="ohqa-video-warning"><strong>Photos only.</strong> Video is not supported or promised in this release. Accepted: JPEG, PNG, WebP, HEIC and HEIF; 25 MiB per photo.</div>
        ${this.editable ? `<label class="ohqa-drop"><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif"><strong>Choose photos</strong><span>or drop up to ${Math.max(0, 100 - ready)} here · three upload at once</span></label>` : ''}
        <div class="ohqa-summary"><span>${ready} stored</span><span>${this.queue.length} in queue</span><span>${formatBytes(totalBytes)} stored</span></div>
        ${this.error ? `<p class="ohqa-alert ohqa-alert-error" role="alert">${escapeHtml(this.error)}</p>` : ''}
        ${this.message ? `<p class="ohqa-alert ohqa-alert-ok">${escapeHtml(this.message)}</p>` : ''}
        ${queueMarkup ? `<div class="ohqa-queue"><h3>Upload progress</h3>${queueMarkup}</div>` : ''}
        <div class="ohqa-review-head"><h3>Tenant packet preview</h3><span>Drag cards or use Earlier / Later</span></div>
        <div class="ohqa-media-grid">${itemMarkup || '<div class="ohqa-empty">No photos yet. Add the move-in condition photos above.</div>'}</div>
        ${this.packet.inspection?.state === "tenant_responded" ? '<button class="ohqa-primary" data-act="correction">Start a correction round</button>' : ''}
        ${this.packet.qa_reset_allowed ? `<details class="ohqa-reset"><summary>Reset this QA rehearsal</summary><p>Listing 10518 only. This removes this rehearsal’s contract, inspection media and QA account, then restores the same link to approved and unclaimed.</p><input data-field="reset-confirm" placeholder="Type RESET 10518"><button class="ohqa-danger" data-act="reset">Reset listing 10518</button></details>` : ''}
      </section>`;
    this.bind();
    window.__onehomeUploaderHasUnsettled = () => this.unsettled;
  }

  bind() {
    const input = this.host.querySelector('input[type="file"]');
    input?.addEventListener("change", () => this.addFiles([...input.files]));
    const drop = this.host.querySelector(".ohqa-drop");
    drop?.addEventListener("dragover", (event) => { event.preventDefault(); drop.classList.add("is-over"); });
    drop?.addEventListener("dragleave", () => drop.classList.remove("is-over"));
    drop?.addEventListener("drop", (event) => { event.preventDefault(); drop.classList.remove("is-over"); this.addFiles([...event.dataTransfer.files]); });
    this.host.querySelectorAll("[data-act]").forEach((button) => button.addEventListener("click", () => this.action(button)));
    this.host.querySelectorAll(".ohqa-queue-item").forEach((card) => {
      const entry = this.queue.find((candidate) => candidate.clientId === card.dataset.clientId);
      card.querySelector('[data-field="room"]')?.addEventListener("input", (event) => { entry.room = event.target.value; });
      card.querySelector('[data-field="caption"]')?.addEventListener("input", (event) => { entry.caption = event.target.value; });
    });
    this.host.querySelectorAll(".ohqa-media-card").forEach((card) => {
      card.addEventListener("dragstart", () => { this.dragId = card.dataset.itemId; });
      card.addEventListener("dragover", (event) => event.preventDefault());
      card.addEventListener("drop", (event) => { event.preventDefault(); this.dropOn(card.dataset.itemId); });
    });
  }

  addFiles(files) {
    this.error = "";
    const allowed = new Set(this.packet.upload.allowed_mime_types);
    const currentBytes = this.queue.filter((entry) => entry.status !== "cancelled").reduce((sum, entry) => sum + entry.file.size, 0);
    let addedBytes = 0;
    for (const file of files) {
      if (!allowed.has(file.type)) { this.error = `${file.name}: unsupported type. Video is not supported.`; continue; }
      if (file.size > this.packet.upload.max_file_bytes) { this.error = `${file.name}: larger than 25 MiB.`; continue; }
      if (this.packet.items.length + this.queue.length >= this.packet.upload.max_items) { this.error = "This walkthrough is limited to 100 photos."; break; }
      if (currentBytes + addedBytes + file.size > this.packet.upload.max_queue_bytes) { this.error = "This upload queue is limited to 500 MiB at a time."; break; }
      addedBytes += file.size;
      this.queue.push({ clientId: crypto.randomUUID(), file, status: "pending", progress: 0, room: "", caption: "", error: "", xhr: null, storagePath: "" });
    }
    this.render();
    if (!FIXTURE_MODE) this.pump();
  }

  pump() {
    while (this.active < this.packet.upload.concurrency) {
      const next = this.queue.find((entry) => entry.status === "pending");
      if (!next) break;
      this.upload(next);
    }
  }

  async upload(entry) {
    this.active += 1;
    entry.status = "uploading";
    entry.progress = 0;
    const extension = (entry.file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
    entry.storagePath = `${this.packet.upload.path_prefix}${crypto.randomUUID()}.${extension}`;
    this.render();
    try {
      await uploadWithProgress(entry, (progress) => { entry.progress = progress; this.updateProgress(entry); });
      await ownerApi("add_item", { inspection_id: this.packet.inspection_id, storage_path: entry.storagePath,
        original_name: entry.file.name, mime_type: entry.file.type, byte_size: entry.file.size,
        room: entry.room, caption: entry.caption });
      entry.status = "complete";
      entry.progress = 100;
      this.queue = this.queue.filter((candidate) => candidate !== entry);
      await this.refresh("Photo uploaded and added to the packet.");
    } catch (error) {
      if (entry.status !== "cancelled") {
        entry.status = "failed";
        entry.error = error?.message || String(error);
        if (entry.storagePath) ownerApi("cleanup_upload", { storage_path: entry.storagePath }).catch(() => {});
      }
      this.render();
    } finally {
      this.active -= 1;
      this.pump();
    }
  }

  updateProgress(entry) {
    const card = this.host.querySelector(`[data-client-id="${entry.clientId}"]`);
    const bar = card?.querySelector(".ohqa-progress span");
    if (bar) bar.style.width = `${entry.progress}%`;
    const status = card?.querySelector(".ohqa-status");
    if (status) status.textContent = statusText(entry);
  }

  async refresh(message = "") {
    if (!FIXTURE_MODE) this.packet = await ownerApi("owner_packet");
    this.message = message;
    this.error = "";
    this.render();
  }

  async action(button) {
    const action = button.dataset.act;
    const queueCard = button.closest(".ohqa-queue-item");
    const mediaCard = button.closest(".ohqa-media-card");
    if (action === "cancel" && queueCard) {
      const entry = this.queue.find((candidate) => candidate.clientId === queueCard.dataset.clientId);
      entry.status = "cancelled";
      entry.xhr?.abort();
      if (entry.storagePath && !FIXTURE_MODE) ownerApi("cleanup_upload", { storage_path: entry.storagePath }).catch(() => {});
      this.queue = this.queue.filter((candidate) => candidate !== entry);
      this.render();
      return;
    }
    if (action === "retry" && queueCard) {
      const entry = this.queue.find((candidate) => candidate.clientId === queueCard.dataset.clientId);
      entry.status = "pending"; entry.progress = 0; entry.error = ""; entry.storagePath = "";
      this.render(); if (!FIXTURE_MODE) this.pump(); return;
    }
    if (mediaCard && ["up", "down"].includes(action)) {
      const index = this.packet.items.findIndex((item) => item.id === mediaCard.dataset.itemId);
      const target = action === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= this.packet.items.length) return;
      [this.packet.items[index], this.packet.items[target]] = [this.packet.items[target], this.packet.items[index]];
      await this.saveOrder(); return;
    }
    if (action === "save" && mediaCard) {
      const room = mediaCard.querySelector('[data-field="saved-room"]').value;
      const caption = mediaCard.querySelector('[data-field="saved-caption"]').value;
      if (!FIXTURE_MODE) await ownerApi("update_item", { item_id: mediaCard.dataset.itemId, room, caption });
      const item = this.packet.items.find((candidate) => candidate.id === mediaCard.dataset.itemId);
      item.room = room; item.host_note = caption; this.message = "Room and caption saved."; this.render(); return;
    }
    if (action === "delete" && mediaCard) {
      if (!confirm("Remove this photo from the draft walkthrough?")) return;
      if (!FIXTURE_MODE) await ownerApi("delete_item", { item_id: mediaCard.dataset.itemId });
      this.packet.items = this.packet.items.filter((item) => item.id !== mediaCard.dataset.itemId);
      this.message = "Photo removed from the draft."; this.render(); return;
    }
    if (action === "correction") {
      if (!FIXTURE_MODE) await ownerApi("start_correction", { inspection_id: this.packet.inspection_id });
      await this.refresh("A new draft correction round is ready."); return;
    }
    if (action === "reset") {
      const confirmText = this.host.querySelector('[data-field="reset-confirm"]').value;
      if (confirmText !== "RESET 10518") { this.error = "Type RESET 10518 exactly."; this.render(); return; }
      if (!confirm("Reset only QA listing 10518 and delete this rehearsal account and media?")) return;
      if (FIXTURE_MODE) { this.message = "Fixture only: reset validation passed; no data changed."; this.render(); return; }
      const result = await ownerApi("qa_reset", { confirm: confirmText, claim_id: this.packet.claim_id, contract_id: this.packet.contract_id });
      alert(result.qa_account_deleted ? "QA listing 10518 is approved and unclaimed again. The test account was removed." : "The listing was reset, but account cleanup needs support.");
      location.reload();
    }
  }

  async dropOn(targetId) {
    if (!this.dragId || this.dragId === targetId) return;
    const from = this.packet.items.findIndex((item) => item.id === this.dragId);
    const to = this.packet.items.findIndex((item) => item.id === targetId);
    const [moved] = this.packet.items.splice(from, 1);
    this.packet.items.splice(to, 0, moved);
    this.dragId = null;
    await this.saveOrder();
  }

  async saveOrder() {
    this.packet.items.forEach((item, index) => { item.ordinal = index + 1; });
    this.render();
    if (!FIXTURE_MODE) await ownerApi("reorder_items", { inspection_id: this.packet.inspection_id, item_ids: this.packet.items.map((item) => item.id) });
    this.message = "Photo order saved.";
    this.render();
  }
}

function uploadWithProgress(entry, onProgress) {
  return new Promise((resolve, reject) => {
    const encodedPath = entry.storagePath.split("/").map(encodeURIComponent).join("/");
    const xhr = new XMLHttpRequest();
    entry.xhr = xhr;
    xhr.open("POST", `${ONEHOME_SUPABASE_URL}/storage/v1/object/rental-evidence/${encodedPath}`);
    xhr.setRequestHeader("apikey", ONEHOME_ANON_KEY);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken()}`);
    xhr.setRequestHeader("Content-Type", entry.file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onerror = () => reject(new Error("Upload failed. Check the connection and retry."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`));
    xhr.send(entry.file);
  });
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "0 B";
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function statusText(entry) {
  if (entry.status === "uploading") return `Uploading · ${entry.progress}%`;
  if (entry.status === "failed") return entry.error || "Failed";
  if (entry.status === "pending") return "Waiting";
  return "Ready";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function escapeAttr(value) { return escapeHtml(value); }

let uploaderAttemptAt = 0;
async function maybeMountUploader() {
  if ((!CLAIM_TOKEN && !FIXTURE_MODE) || document.querySelector("#onehome-owner-media")) return;
  if (!FIXTURE_MODE && Date.now() - uploaderAttemptAt < 3000) return;
  uploaderAttemptAt = Date.now();
  let packet;
  try { packet = FIXTURE_MODE ? fixturePacket() : await ownerApi("owner_packet"); }
  catch { return; }
  const host = document.createElement("div");
  host.id = "onehome-owner-media";
  if (FIXTURE_MODE) {
    const root = document.querySelector("#root");
    root.style.display = "none";
    const fixtureRoot = document.createElement("div");
    fixtureRoot.id = "onehome-qa-fixture-root";
    fixtureRoot.innerHTML = `<main class="ohqa-fixture-shell"><header><div><strong>OneHome</strong><span>Owner QA walkthrough</span></div><span>Listing 10518 · Fixture data only</span></header><section class="ohqa-fixture-title"><div class="ohqa-eyebrow">Safe rehearsal</div><h1>Move-in inspection media</h1><p>No claim, account, message, or payment is created in this visual fixture.</p></section></main>`;
    document.body.append(fixtureRoot);
    fixtureRoot.querySelector("main").append(host);
  } else {
    const heading = [...document.querySelectorAll("h2,h3")].find((node) => textMatches(node, /Move-in walkthrough|Acta de ingreso/i));
    const section = heading?.closest("section");
    if (!section?.parentElement) return;
    section.parentElement.insertBefore(host, section.nextSibling);
  }
  new OwnerInspectionUploader(host, packet);
}

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("button");
  if (!button || !window.__onehomeUploaderHasUnsettled?.()) return;
  if (/Send to Tenant|Enviar al inquilino|Send in OneHome Messages|Enviar en Mensajes/i.test(button.textContent || "")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    document.querySelector("#onehome-owner-media")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}, true);

function mountOtpHelp() {
  const code = document.querySelector('input[autocomplete="one-time-code"]');
  if (!code || document.querySelector("#ohqa-otp-help")) return;
  const help = document.createElement("div");
  help.id = "ohqa-otp-help";
  help.className = "ohqa-otp-help";
  help.innerHTML = `<strong>${tr("Still waiting for the email?", "¿Todavía espera el correo?")}</strong><span>${tr("Check Inbox, Spam and Promotions, then search for 'One World Labs'. Delivery can be accepted by your email provider before it appears in the visible inbox.", "Revise Recibidos, Spam y Promociones; luego busque 'One World Labs'. Su proveedor puede aceptar el correo antes de que aparezca en la bandeja visible.")}</span>`;
  code.insertAdjacentElement("afterend", help);
}

let observedLocale = currentLocale();
const observer = new MutationObserver(() => {
  const locale = currentLocale();
  if (locale !== observedLocale) {
    observedLocale = locale;
    document.querySelector("#ohqa-document-modal")?.remove();
  }
  if (!FIXTURE_MODE) mountTerms();
  mountCountryPhone();
  mountOtpHelp();
  translateReviewFlow();
  void maybeMountUploader();
});
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["lang"] });
mountTerms();
mountCountryPhone();
mountOtpHelp();
translateReviewFlow();
void maybeMountUploader();
