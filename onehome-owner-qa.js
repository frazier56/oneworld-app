const ONEHOME_SUPABASE_URL = "https://wseblryyqxawvbjmylbo.supabase.co";
const ONEHOME_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZWJscnl5cXhhd3Ziam15bGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU4NjksImV4cCI6MjA5MzUyMTg2OX0.y2yfMwSC_eh_jzI5eXsp6qD5zkl0OICtESV070EhRQM";
const REVIEW_API = `${ONEHOME_SUPABASE_URL}/functions/v1/listing-review`;
const INSPECTION_API = `${ONEHOME_SUPABASE_URL}/functions/v1/rental-inspection`;
const PLATFORM_TERMS_VERSION = "oneworld-platform-owner-review-2026-09-01";
const PROPERTY_TERMS_VERSION = "onehome-property-owner-review-draft-2026-09-03-v4";
const CLAIM_TOKEN = location.pathname.match(/^\/rentals\/review\/([0-9a-f]{48})\/?$/i)?.[1]?.toLowerCase() || "";
const FIXTURE_MODE = new URLSearchParams(location.search).get("onehomeQaFixture") === "owner-media";
const OWNER_MEDIA_MODE = new URLSearchParams(location.search).get("ownerMedia") === "1";

const termsState = window.__onehomeOwnerTerms || {
  platform: false,
  property: false,
  platformRead: false,
  propertyRead: false,
  existingSaved: false,
  busy: false,
};
window.__onehomeOwnerTerms = termsState;

const signupState = window.__onehomeOwnerSignup || {
  email: "",
  fullName: "",
  phone: "",
  password: "",
  startedAt: 0,
  pendingSession: null,
  mfaFactorId: "",
  resendBusy: false,
  resendAvailableAt: 0,
  resendCaptchaToken: "",
  resendWidgetId: null,
};
window.__onehomeOwnerSignup = signupState;

const claimAvailabilityState = {
  checked: false,
  alreadyClaimed: false,
};

// The email-code endpoint serves both first-time signups and existing One ID
// accounts. After verification we distinguish those identities by creation time:
// only a user created by this attempt receives the submitted password. Existing
// users keep their credentials, and an enrolled MFA factor must be completed at
// AAL2 before the property handoff continues.
const ONEHOME_TURNSTILE_SITE_KEY = "0x4AAAAAAEAsMHkBsF_CmIVg";
const ONEHOME_AUTH_STORAGE_KEY = "sb-wseblryyqxawvbjmylbo-auth-token";

// The profile write needs no client-side compatibility layer. `signup_intent`
// now accepts 'rental_owner' at the database (migration
// onehome_allow_rental_owner_signup_intent), and `authenticated` holds a
// column-level SELECT on profiles.id, so `.update(...).select("id")` returns
// normally. The previous window.fetch wrapper is deleted rather than repaired:
// it only fired when the body arrived as a string on `init`, which the bundled
// supabase-js does not guarantee, and it synthesised a success response the
// server never sent — which would report a real failure to the user as success.

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

function mountClaimedLinkGuard() {
  if (!claimAvailabilityState.alreadyClaimed) return;
  const email = document.querySelector('input[type="email"][autocomplete="email"]');
  const createButton = email?.closest("section")?.querySelector("button.btn-primary") ||
    [...document.querySelectorAll("button.btn-primary")].find((button) =>
      button.parentElement?.querySelector?.('input[type="email"][autocomplete="email"]'));
  const accountRoot = createButton?.parentElement;
  if (!email || !createButton || !accountRoot) return;

  let notice = document.querySelector("#ohqa-claim-used");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "ohqa-claim-used";
    notice.className = "mt-4 rounded-2xl border border-amber-500/35 bg-amber-500/[0.08] p-4";
    notice.setAttribute("role", "alert");
    notice.innerHTML = `
      <p class="text-[14px] font-black">${tr("This invitation has already been used", "Esta invitación ya se utilizó")}</p>
      <p class="mt-1 text-[12.5px] leading-relaxed opacity-70">${tr(
        "This home is already connected to its owner. Ask the sender for a new invitation.",
        "Este inmueble ya está conectado a su propietaria. Pida al remitente una invitación nueva."
      )}</p>`;
    createButton.insertAdjacentElement("beforebegin", notice);
  }

  const fields = email.closest("div.mt-4");
  if (fields) {
    fields.hidden = true;
    fields.style.display = "none";
  }
  const terms = accountRoot.querySelector("#onehome-separate-terms");
  if (terms) {
    terms.hidden = true;
    terms.style.display = "none";
  }
  accountRoot.querySelector("#ohqa-signup-error")?.remove();
  createButton.hidden = true;
  createButton.style.display = "none";
}

async function checkClaimAvailability() {
  if (!CLAIM_TOKEN || claimAvailabilityState.checked) return;
  claimAvailabilityState.checked = true;
  try {
    const response = await fetch(`${REVIEW_API}?t=${encodeURIComponent(CLAIM_TOKEN)}`, {
      headers: { apikey: ONEHOME_ANON_KEY, Authorization: `Bearer ${ONEHOME_ANON_KEY}` },
      cache: "no-store",
    });
    const packet = await response.json().catch(() => ({}));
    claimAvailabilityState.alreadyClaimed = response.ok && packet?.already_claimed === true;
    if (claimAvailabilityState.alreadyClaimed) window.setTimeout(mountClaimedLinkGuard, 800);
  } catch { /* The primary review request still owns availability errors. */ }
}

// This review bundle intentionally mounts only review and inspection routes.
// Force shell links into the full application so React Router does not keep a
// user on an empty route when they open Home, Messages, or Profile.
document.addEventListener("click", (event) => {
  const anchor = event.target.closest?.("a[href]");
  if (!anchor || !CLAIM_TOKEN) return;
  const destination = new URL(anchor.href, location.href);
  if (destination.origin !== location.origin || !destination.pathname.startsWith("/rentals")) return;
  if (/^\/rentals\/(?:review|inspection)\//i.test(destination.pathname)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  location.assign(destination.href);
}, true);

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
    <h2 id="ohqa-document-title">${tr("OneHome Terms", "Términos de OneHome")}</h2>
    <p>${tr("OneHome provides the account, electronic records, messaging, payment-record status and support tools. OneHome is not the property owner and does not supply the home.", "OneHome proporciona la cuenta, los registros electrónicos, la mensajería, el estado de los registros de pago y las herramientas de soporte. OneHome no es el propietario ni suministra el inmueble.")}</p>
    <p>${tr("Your OneHome consent is recorded separately from the property owner's terms.", "Su consentimiento a OneHome se registra por separado de los términos del propietario.")}</p>
    <p>${tr("Accepting these terms does not sign the lease or confirm a payment.", "Aceptar estos términos no firma el contrato ni confirma un pago.")}</p>
    <p class="ohqa-source-note">${tr("This current OneHome terms version is approved by the owner for use now. A future counsel review is planned; until then, unresolved lease clauses listed in the Property Owner Terms remain excluded and require separate final decisions.", "Esta versión actual de los Términos de OneHome está aprobada por el propietario para su uso desde ahora. Se planea una revisión futura por un abogado; mientras tanto, las cláusulas no resueltas enumeradas en los Términos del propietario permanecen excluidas y requieren decisiones finales por separado.")}</p>`;
  return `
    <h2 id="ohqa-document-title">${tr("Property Owner Terms", "Términos del propietario")}</h2>
    <h3>${tr("Current listing terms", "Términos actuales del inmueble")}</h3>
    <ul>
      <li><strong>8,600,000 COP</strong> ${tr("for each monthly rental period.", "por cada período mensual de arriendo.")}</li>
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
  const returnFocus = document.activeElement;
  const alreadyAccepted = !!termsState[kind];
  const modal = document.createElement("div");
  modal.id = "ohqa-document-modal";
  modal.className = "ohqa-document-modal";
  modal.innerHTML = `<div class="ohqa-document-card" role="dialog" aria-modal="true" aria-labelledby="ohqa-document-title">
    <button type="button" class="ohqa-document-close" aria-label="${tr("Close", "Cerrar")}">×</button>
    <div class="ohqa-document-scroll" tabindex="0">${termDocument(kind)}<div class="ohqa-document-end" aria-hidden="true"></div></div>
    <label class="ohqa-document-accept">
      <input type="checkbox" ${alreadyAccepted ? "checked disabled" : "disabled"}>
      <span>${tr("I agree to accept", "Acepto")}</span>
    </label>
  </div>`;
  document.body.append(modal);
  const scroller = modal.querySelector(".ohqa-document-scroll");
  const accept = modal.querySelector(".ohqa-document-accept input");
  let userScrolled = false;
  const markRead = () => {
    if (alreadyAccepted) return;
    if (scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 8) return;
    if (scroller.scrollHeight > scroller.clientHeight + 8 && !userScrolled) return;
    termsState[`${kind}Read`] = true;
    accept.disabled = false;
  };
  const endMarker = scroller.querySelector(".ohqa-document-end");
  const endObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) markRead();
  }, { root: scroller, threshold: 0.95 });
  endObserver.observe(endMarker);
  scroller.addEventListener("scroll", () => { userScrolled = true; markRead(); }, { passive: true });
  scroller.addEventListener("wheel", () => { userScrolled = true; markRead(); }, { passive: true });
  scroller.addEventListener("touchend", () => { userScrolled = true; markRead(); }, { passive: true });
  requestAnimationFrame(markRead);
  const close = () => {
    endObserver.disconnect();
    modal.remove();
    refreshTermsPanel();
    const replacement = document.querySelector(`[data-document="${kind}"]`);
    if (replacement instanceof HTMLElement) replacement.focus();
    else if (returnFocus instanceof HTMLElement) returnFocus.focus();
  };
  modal.querySelector(".ohqa-document-close").addEventListener("click", close);
  accept.addEventListener("change", () => {
    if (accept.disabled || alreadyAccepted || !accept.checked) return;
    termsState[kind] = true;
    close();
  });
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const focusable = [...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex="0"]')].filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  scroller.focus();
}

function termsPanel() {
  const panel = document.createElement("section");
  panel.id = "onehome-separate-terms";
  panel.className = "ohqa-terms";
  panel.dataset.locale = currentLocale();
  panel.innerHTML = `
    <div class="ohqa-term-row">
      <span class="ohqa-term-title"><strong>${tr("OneHome Terms", "Términos de OneHome")}</strong><button type="button" class="ohqa-document-open" data-document="platform">${tr("View", "Ver")}</button></span>
      <span class="ohqa-term-status ${termsState.platform ? "is-complete" : "is-empty"}" role="status" aria-label="${termsState.platform ? tr("OneHome Terms completed", "Términos de OneHome completados") : tr("OneHome Terms not completed", "Términos de OneHome no completados")}">${termsState.platform ? "✓" : ""}</span>
    </div>
    <div class="ohqa-term-row">
      <span class="ohqa-term-title"><strong>${tr("Property Owner Terms", "Términos del propietario")}</strong><button type="button" class="ohqa-document-open" data-document="property">${tr("View", "Ver")}</button></span>
      <span class="ohqa-term-status ${termsState.property ? "is-complete" : "is-empty"}" role="status" aria-label="${termsState.property ? tr("Property Owner Terms completed", "Términos del propietario completados") : tr("Property Owner Terms not completed", "Términos del propietario no completados")}">${termsState.property ? "✓" : ""}</span>
    </div>
    <p class="ohqa-terms-error" role="alert" hidden>${tr("Open and agree to both documents before continuing.", "Abra y acepte ambos documentos antes de continuar.")}</p>`;
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
    error.textContent = message || tr("Open and agree to both documents before continuing.", "Abra y acepte ambos documentos antes de continuar.");
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
    if (!response.ok) {
      const message = result.code === "already_claimed"
        ? tr(
          "This invitation has already been used. Ask the sender for a new invitation.",
          "Esta invitación ya se utilizó. Pida al remitente una invitación nueva."
        )
        : result.message || tr("The acknowledgments could not be saved.", "No se pudieron guardar los reconocimientos.");
      throw new Error(message);
    }
    termsState.existingSaved = true;
    return true;
  } catch (error) {
    showTermsError(error?.message || String(error));
    return false;
  } finally {
    termsState.busy = false;
  }
}

function syncCreateTermsGate() {
  const email = document.querySelector('input[type="email"][autocomplete="email"]');
  const button = email?.closest("div.mt-4")?.parentElement?.querySelector("button.btn-primary") ||
    [...document.querySelectorAll("button.btn-primary")].find((candidate) => candidate.parentElement?.querySelector?.('input[type="email"][autocomplete="email"]'));
  if (!button) return;
  const complete = termsState.platform && termsState.property;
  button.classList.toggle("ohqa-terms-blocked", !complete);
  if (!complete) button.setAttribute("aria-disabled", "true");
  else button.removeAttribute("aria-disabled");
}

function showSignupError(message) {
  let error = document.querySelector("#ohqa-signup-error");
  if (!error) {
    error = document.createElement("p");
    error.id = "ohqa-signup-error";
    error.className = "ohqa-signup-error";
    error.setAttribute("role", "alert");
    const createButton = [...document.querySelectorAll("button.btn-primary")].find((button) =>
      button.parentElement?.querySelector?.('input[type="email"][autocomplete="email"]'));
    createButton?.insertAdjacentElement("beforebegin", error);
  }
  if (error) error.textContent = message;
}

function authErrorMessage(packet, fallback) {
  return packet?.msg || packet?.message || packet?.error_description || packet?.error || fallback;
}

async function onehomeJson(url, { method = "GET", token = "", body, prefer = "" } = {}) {
  const headers = { apikey: ONEHOME_ANON_KEY, Authorization: `Bearer ${token || ONEHOME_ANON_KEY}` };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const packet = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(authErrorMessage(packet, tr("The account could not be verified.", "No se pudo verificar la cuenta.")));
    error.code = packet?.error_code || packet?.code || "";
    error.status = response.status;
    throw error;
  }
  return packet;
}

function jwtPayload(token) {
  try {
    const encoded = String(token || "").split(".")[1] || "";
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch { return {}; }
}

function persistOwnerSession(session) {
  const complete = {
    ...session,
    expires_at: session?.expires_at || Math.round(Date.now() / 1000) + Number(session?.expires_in || 3600),
  };
  localStorage.setItem(ONEHOME_AUTH_STORAGE_KEY, JSON.stringify(complete));
  signupState.pendingSession = complete;
  return complete;
}

function verificationStatus(section, message = "", isError = true) {
  let status = section?.querySelector("#ohqa-verification-status");
  if (!status && section) {
    status = document.createElement("p");
    status.id = "ohqa-verification-status";
    status.className = "mt-3 text-[12px] font-semibold";
    status.setAttribute("role", "alert");
    section.append(status);
  }
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("text-red-600", isError);
  status.classList.toggle("text-brand", !isError);
}

async function finishOwnerHandoff(session, { setNewPassword = false } = {}) {
  const active = persistOwnerSession(session);
  const access = active.access_token;
  const userId = active.user?.id || jwtPayload(access).sub;
  if (!access || !userId) throw new Error(tr("Your session expired. Please request a new code.", "Su sesión venció. Solicite un código nuevo."));

  if (setNewPassword) {
    await onehomeJson(`${ONEHOME_SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      token: access,
      body: {
        password: signupState.password,
        data: { full_name: signupState.fullName, phone: signupState.phone, signup_app: "onerental" },
      },
    });
  }

  const profile = await onehomeJson(`${ONEHOME_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id`, {
    method: "PATCH",
    token: access,
    prefer: "return=representation",
    body: {
      full_name: signupState.fullName,
      phone: signupState.phone,
      signup_intent: "rental_owner",
      signup_app: "onerental",
      entry_product: "onerental",
    },
  });
  if (!Array.isArray(profile) || !profile.length) {
    throw new Error(tr("Your profile could not be completed. Nothing was transferred.", "No se pudo completar su perfil. No se transfirió nada."));
  }

  const claim = await onehomeJson(`${ONEHOME_SUPABASE_URL}/rest/v1/rpc/rental_claim_property`, {
    method: "POST",
    token: access,
    body: { p_token: CLAIM_TOKEN },
  });
  const handoff = Array.isArray(claim) ? claim[0] : claim;
  if (!handoff?.contract_id || !handoff?.inspection_id) {
    throw new Error(tr("The home handoff was incomplete. Nothing was lost; please try again.", "La entrega del inmueble quedó incompleta. No se perdió nada; intente de nuevo."));
  }
  signupState.password = "";
  return handoff;
}

function mountOwnerMfa(section) {
  section.querySelectorAll(":scope > *:not(#ohqa-owner-mfa)").forEach((node) => { node.hidden = true; });
  let host = section.querySelector("#ohqa-owner-mfa");
  if (!host) {
    host = document.createElement("div");
    host.id = "ohqa-owner-mfa";
    host.innerHTML = `
      <h2 class="text-[18px] font-black">${tr("Complete your security check", "Complete su verificación de seguridad")}</h2>
      <p class="mt-2 text-[13px] leading-relaxed opacity-70">${tr(
        "This email already belongs to a One ID account with MFA. Enter the six-digit code from your authenticator app. Your existing password will not be changed.",
        "Este correo ya pertenece a una cuenta One ID con MFA. Ingrese el código de seis dígitos de su aplicación de autenticación. Su contraseña actual no cambiará."
      )}</p>
      <input id="ohqa-owner-mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="mt-4 w-full rounded-xl border border-ink/15 bg-transparent px-3 py-3 text-center text-[24px] font-black tracking-[0.35em] outline-none focus:border-brand dark:border-white/20" placeholder="000000">
      <p id="ohqa-owner-mfa-error" class="mt-3 text-[12px] font-semibold text-red-600" role="alert"></p>
      <button type="button" data-ohqa-mfa-verify="true" class="btn-primary mt-4 w-full">${tr("Verify MFA and continue", "Verificar MFA y continuar")}</button>
      <button type="button" data-ohqa-auth-cancel="true" class="btn-ghost mt-2 w-full">${tr("Use a different email", "Usar otro correo")}</button>`;
    section.append(host);
  }
  host.hidden = false;
  host.querySelector("#ohqa-owner-mfa-code")?.focus();
}

async function verifyOwnerEmailCode(button, codeInput) {
  const section = codeInput.closest("section");
  const code = codeInput.value.replace(/\D/g, "").slice(0, 6);
  if (code.length !== 6 || button.disabled) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "…";
  verificationStatus(section, "");
  try {
    const verified = await onehomeJson(`${ONEHOME_SUPABASE_URL}/auth/v1/verify`, {
      method: "POST",
      body: { email: signupState.email, token: code, type: "email" },
    });
    const session = persistOwnerSession(verified);
    const verifiedFactors = (verified.user?.factors || []).filter((factor) => factor.status === "verified");
    const aal = jwtPayload(session.access_token).aal || "aal1";
    const createdAt = Date.parse(verified.user?.created_at || "");
    if (!Number.isFinite(createdAt)) throw new Error(tr("The account identity could not be confirmed.", "No se pudo confirmar la identidad de la cuenta."));
    const createdByThisAttempt = !!signupState.startedAt && createdAt >= signupState.startedAt - 5000;

    if (verifiedFactors.length && aal !== "aal2") {
      const factor = verifiedFactors.find((candidate) => candidate.factor_type === "totp");
      if (!factor) throw new Error(tr("Complete MFA from the One ID sign-in screen, then reopen this invitation.", "Complete MFA desde la pantalla de inicio de One ID y luego vuelva a abrir esta invitación."));
      signupState.mfaFactorId = factor.id;
      mountOwnerMfa(section);
      return;
    }

    await finishOwnerHandoff(session, { setNewPassword: createdByThisAttempt });
    verificationStatus(section, tr("Your home is connected. Opening it now…", "Su inmueble está conectado. Abriéndolo ahora…"), false);
    window.setTimeout(() => location.reload(), 350);
  } catch (error) {
    verificationStatus(section, error?.message || String(error));
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function verifyOwnerMfa(button) {
  const host = button.closest("#ohqa-owner-mfa");
  const input = host?.querySelector("#ohqa-owner-mfa-code");
  const errorNode = host?.querySelector("#ohqa-owner-mfa-error");
  const code = input?.value?.replace(/\D/g, "").slice(0, 6) || "";
  const session = signupState.pendingSession;
  if (code.length !== 6 || !session?.access_token || !signupState.mfaFactorId || button.disabled) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "…";
  if (errorNode) errorNode.textContent = "";
  try {
    const challenge = await onehomeJson(`${ONEHOME_SUPABASE_URL}/auth/v1/factors/${encodeURIComponent(signupState.mfaFactorId)}/challenge`, {
      method: "POST",
      token: session.access_token,
      body: { factorId: signupState.mfaFactorId },
    });
    const upgradedRaw = await onehomeJson(`${ONEHOME_SUPABASE_URL}/auth/v1/factors/${encodeURIComponent(signupState.mfaFactorId)}/verify`, {
      method: "POST",
      token: session.access_token,
      body: { challenge_id: challenge.id, code },
    });
    const upgraded = persistOwnerSession({ ...upgradedRaw, user: upgradedRaw.user || session.user });
    if (jwtPayload(upgraded.access_token).aal !== "aal2") {
      throw new Error(tr("MFA verification did not reach the required assurance level.", "La verificación MFA no alcanzó el nivel de seguridad requerido."));
    }
    await finishOwnerHandoff(upgraded, { setNewPassword: false });
    if (errorNode) {
      errorNode.classList.remove("text-red-600");
      errorNode.classList.add("text-brand");
      errorNode.textContent = tr("Your home is connected. Opening it now…", "Su inmueble está conectado. Abriéndolo ahora…");
    }
    window.setTimeout(() => location.reload(), 350);
  } catch (error) {
    if (errorNode) errorNode.textContent = error?.message || String(error);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function cancelOwnerAuth() {
  localStorage.removeItem(ONEHOME_AUTH_STORAGE_KEY);
  signupState.password = "";
  signupState.pendingSession = null;
  signupState.mfaFactorId = "";
  location.reload();
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest?.("button");
  if (!button || !CLAIM_TOKEN) return;
  const label = (button.textContent || "").trim();
  if (button.dataset.ohqaMfaVerify === "true") {
    event.preventDefault();
    event.stopImmediatePropagation();
    void verifyOwnerMfa(button);
    return;
  }
  if (button.dataset.ohqaAuthCancel === "true") {
    event.preventDefault();
    event.stopImmediatePropagation();
    cancelOwnerAuth();
    return;
  }
  const codeInput = button.closest("section")?.querySelector?.('input[autocomplete="one-time-code"]');
  if (codeInput && /Verify and continue|Verificar y continuar/i.test(label)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    void verifyOwnerEmailCode(button, codeInput);
    return;
  }
  const accountArea = button.parentElement?.querySelector?.('input[type="email"][autocomplete="email"]');
  const reviewArea = button.closest("section")?.querySelector?.('input[autocomplete="name"]');
  const isCreate = !!accountArea && button.classList.contains("btn-primary");
  const isReviewDecision = !!reviewArea && button.classList.contains("btn-primary");
  if (!isCreate && !isReviewDecision) return;
  if (isCreate) {
    signupState.email = accountArea.value?.trim().toLowerCase() || "";
    signupState.fullName = document.querySelector('input[autocomplete="name"]')?.value?.trim() || "";
    signupState.phone = document.querySelector('input[type="tel"][autocomplete="tel"]')?.value?.trim() || "";
    signupState.password = document.querySelector('input[autocomplete="new-password"]')?.value || "";
    signupState.startedAt = Date.now();
    signupState.resendAvailableAt = Date.now() + 60000;
    const phone = document.querySelector(".ohqa-phone-canonical");
    if (phone && phone.dataset.valid !== "true") {
      event.preventDefault();
      event.stopImmediatePropagation();
      const status = phone.querySelector(".ohqa-phone-status");
      if (status) {
        status.textContent = tr("Enter a valid phone number", "Ingrese un número de teléfono válido");
        status.classList.add("is-invalid");
      }
      phone.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
  }
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
    return;
  }
}, true);

const flowTextOriginal = new WeakMap();
const flowTextRendered = new WeakMap();
const flowAttributeOriginal = new WeakMap();
function translateReviewFlow(root = document.body) {
  const locale = currentLocale();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('#onehome-separate-terms,#ohqa-document-modal,#onehome-owner-media,a[aria-label="neHome"]')) continue;
    const lastRendered = flowTextRendered.get(node);
    if (!flowTextOriginal.has(node) || (lastRendered != null && node.nodeValue !== lastRendered)) {
      flowTextOriginal.set(node, node.nodeValue);
    }
    const original = flowTextOriginal.get(node);
    const trimmed = original.trim();
    if (!trimmed) continue;
    const translated = window.__onehomeFlowTranslate?.(locale, trimmed, trimmed) || trimmed;
    const leading = original.match(/^\s*/)?.[0] || "";
    const trailing = original.match(/\s*$/)?.[0] || "";
    const rendered = `${leading}${translated}${trailing}`;
    node.nodeValue = rendered;
    flowTextRendered.set(node, rendered);
  }
  root.querySelectorAll?.("[placeholder],[aria-label],[title],[alt]").forEach((element) => {
    let originals = flowAttributeOriginal.get(element);
    if (!originals) { originals = {}; flowAttributeOriginal.set(element, originals); }
    for (const name of ["placeholder", "aria-label", "title", "alt"]) {
      if (!element.hasAttribute(name)) continue;
      if (!(name in originals)) originals[name] = element.getAttribute(name);
      element.setAttribute(name, window.__onehomeFlowTranslate?.(locale, originals[name], originals[name]) || originals[name]);
    }
  });
}

function mountCountryPhone() {
  const source = document.querySelector('input[type="tel"][autocomplete="tel"]');
  if (!source || source.dataset.ohqaPhone === "true" || !window.OneHomeCanonicalPhone) return;
  const localeDefault = { co: "CO", es: "ES", de: "DE", ru: "RU", zh: "CN", pt: "BR", en: "US" }[currentLocale()] || "US";
  window.OneHomeCanonicalPhone.mount(source, {
    defaultCountry: localeDefault,
    validText: tr("Valid phone number", "Número de teléfono válido"),
    invalidText: tr("Enter a valid phone number", "Ingrese un número de teléfono válido"),
  });
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
    upload: { max_image_file_bytes: 26214400, max_video_file_bytes: 314572800, max_images: 100, max_videos: 10,
      max_video_duration_ms: 300000, max_queue_bytes: 1073741824, concurrency: 3, video_supported: true,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "video/mp4", "video/webm", "video/quicktime"], path_prefix: "fixture/" },
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
    const imageCount = items.filter((item) => (item.media_kind || "image") === "image").length;
    const videoCount = items.filter((item) => item.media_kind === "video").length;
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
        <div class="ohqa-thumb">${item.preview_url
          ? (item.media_kind === "video"
            ? `<video src="${escapeAttr(item.preview_url)}" controls preload="metadata" aria-label="${escapeAttr(item.host_note || `Walkthrough video ${index + 1}`)}"></video>`
            : `<img src="${escapeAttr(item.preview_url)}" alt="${escapeAttr(item.host_note || `Walkthrough photo ${index + 1}`)}">`)
          : '<span>Preview unavailable</span>'}</div>
        <div class="ohqa-media-body">
          <div class="ohqa-order"><strong>${index + 1} / ${items.length} · ${item.media_kind === "video" ? "Video" : "Photo"}</strong><span>${formatBytes(item.byte_size)}${item.duration_ms ? ` · ${formatDuration(item.duration_ms)}` : ""}</span></div>
          <dl class="ohqa-timestamps"><div><dt>Captured</dt><dd>${formatTimestamp(item.captured_at)}</dd></div><div><dt>Uploaded</dt><dd>${formatTimestamp(item.uploaded_at || item.created_at)}</dd></div></dl>
          <div class="ohqa-fields"><input data-field="saved-room" value="${escapeAttr(item.room || "")}" placeholder="Room" ${this.editable ? "" : "disabled"}><input data-field="saved-caption" value="${escapeAttr(item.host_note || "")}" placeholder="Caption (optional)" ${this.editable ? "" : "disabled"}></div>
          ${item.verdict === "disputed" ? `<div class="ohqa-tenant-evidence"><strong>Tenant reported a different condition</strong><p>${escapeHtml(item.tenant_note || "")}</p>${item.tenant_preview_url ? `<img src="${escapeAttr(item.tenant_preview_url)}" alt="Tenant condition evidence">` : ""}<p>Responded ${formatTimestamp(item.responded_at)}</p>${item.tenant_evidence_status === "pending_agent_review" ? '<button data-act="confirm-tenant-evidence">Accept and lock tenant evidence</button>' : item.tenant_evidence_status === "accepted" ? `<span class="ohqa-locked">✓ Locked ${formatTimestamp(item.tenant_evidence_locked_at)}</span>` : ""}</div>` : ""}
          ${this.editable ? `<div class="ohqa-item-actions"><button data-act="up" ${index === 0 ? "disabled" : ""}>↑ Earlier</button><button data-act="down" ${index === items.length - 1 ? "disabled" : ""}>↓ Later</button><button data-act="save">Save</button><button class="ohqa-danger-link" data-act="delete">Remove</button></div>` : `<p class="ohqa-frozen">Frozen in the tenant evidence packet. Additional media must be sent in <a href="${escapeAttr(this.packet.message_context?.url || "/messages")}">property messages</a>.</p>`}
        </div>
      </article>`).join("");
    this.host.innerHTML = `
      <section class="ohqa-uploader" aria-labelledby="ohqa-uploader-title">
        <div class="ohqa-uploader-head"><div><div class="ohqa-eyebrow">Move-in inspection · Round ${this.packet.inspection?.round || 1}</div><h2 id="ohqa-uploader-title">Walkthrough photos and videos</h2></div><span class="ohqa-count">${ready} ready</span></div>
        <p class="ohqa-muted">Private evidence for this property. Add room names and captions, verify the immutable timestamps, then release the frozen packet to the tenant.</p>
        <div class="ohqa-video-warning"><strong>Up to 100 photos and 10 videos.</strong> Photos: JPEG, PNG, WebP, HEIC or HEIF, 25 MiB each. Videos: MP4, WebM or QuickTime, 300 MiB and five minutes each.</div>
        ${this.editable ? `<label class="ohqa-drop"><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime"><strong>Choose photos or videos</strong><span>or drop files here · three upload at once</span></label>` : ''}
        <div class="ohqa-summary"><span>${imageCount} / 100 photos</span><span>${videoCount} / 10 videos</span><span>${this.queue.length} in queue</span><span>${formatBytes(totalBytes)} stored</span></div>
        ${this.error ? `<p class="ohqa-alert ohqa-alert-error" role="alert">${escapeHtml(this.error)}</p>` : ''}
        ${this.message ? `<p class="ohqa-alert ohqa-alert-ok">${escapeHtml(this.message)}</p>` : ''}
        ${queueMarkup ? `<div class="ohqa-queue"><h3>Upload progress</h3>${queueMarkup}</div>` : ''}
        <div class="ohqa-review-head"><h3>Tenant packet preview</h3><span>Drag cards or use Earlier / Later</span></div>
        <div class="ohqa-media-grid">${itemMarkup || '<div class="ohqa-empty"><strong>No walkthrough media yet.</strong><span>Upload the first photo or video above. Nothing is visible to a tenant or public listing.</span></div>'}</div>
        ${this.editable && ready ? '<button class="ohqa-primary" data-act="release">Send walkthrough photos and videos</button>' : ''}
        ${!this.editable && this.packet.inspection?.released_at ? `<p class="ohqa-alert ohqa-alert-ok">Released ${formatTimestamp(this.packet.inspection.released_at)} · ${this.packet.inspection.release_reason === "payment" ? "after payment/lease initiation" : "early by listing agent"}</p>` : ''}
        ${!this.editable && this.packet.message_context?.url ? `<a class="ohqa-primary ohqa-message-link" href="${escapeAttr(this.packet.message_context.url)}">Send additional media in property messages</a>` : ''}
        ${this.packet.qa_reset_allowed ? `<details class="ohqa-reset"><summary>Reset this QA rehearsal</summary><p>Listing 10518 only. This removes this rehearsal’s contract, inspection media and QA account, then restores the same link to approved and unclaimed.</p><input data-field="reset-confirm" placeholder="Type RESET 10518"><button class="ohqa-danger" data-act="reset">Reset listing 10518</button></details>` : ''}
      </section>`;
    this.bind();
    window.__onehomeUploaderHasUnsettled = () => this.unsettled;
    syncOwnerMediaCta(ready);
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

  async addFiles(files) {
    this.error = "";
    const allowed = new Set(this.packet.upload.allowed_mime_types);
    const currentBytes = this.queue.filter((entry) => entry.status !== "cancelled").reduce((sum, entry) => sum + entry.file.size, 0);
    let imageCount = this.packet.items.filter((item) => (item.media_kind || "image") === "image").length
      + this.queue.filter((entry) => entry.mediaKind === "image" && entry.status !== "cancelled").length;
    let videoCount = this.packet.items.filter((item) => item.media_kind === "video").length
      + this.queue.filter((entry) => entry.mediaKind === "video" && entry.status !== "cancelled").length;
    let addedBytes = 0;
    for (const file of files) {
      if (!allowed.has(file.type)) { this.error = `${file.name}: unsupported file type.`; continue; }
      const mediaKind = file.type.startsWith("video/") ? "video" : "image";
      const maxBytes = mediaKind === "video" ? this.packet.upload.max_video_file_bytes : this.packet.upload.max_image_file_bytes;
      if (file.size > maxBytes) { this.error = `${file.name}: larger than ${mediaKind === "video" ? "300" : "25"} MiB.`; continue; }
      if (mediaKind === "image" && imageCount >= this.packet.upload.max_images) { this.error = "This walkthrough already has 100 photos."; continue; }
      if (mediaKind === "video" && videoCount >= this.packet.upload.max_videos) { this.error = "This walkthrough already has 10 videos."; continue; }
      if (currentBytes + addedBytes + file.size > this.packet.upload.max_queue_bytes) { this.error = "This upload queue is limited to 1 GiB at a time."; break; }
      let metadata;
      try { metadata = await readMediaMetadata(file, mediaKind); }
      catch (error) { this.error = `${file.name}: ${error?.message || String(error)}`; continue; }
      if (mediaKind === "video" && metadata.durationMs > this.packet.upload.max_video_duration_ms) {
        this.error = `${file.name}: longer than five minutes.`;
        continue;
      }
      addedBytes += file.size;
      if (mediaKind === "video") videoCount += 1; else imageCount += 1;
      this.queue.push({ clientId: crypto.randomUUID(), file, mediaKind, metadata, status: "pending", progress: 0, room: "", caption: "", error: "", xhr: null, storagePath: "" });
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
        media_kind: entry.mediaKind, duration_ms: entry.metadata?.durationMs || null,
        captured_at: entry.metadata?.capturedAt || null, width: entry.metadata?.width || null,
        height: entry.metadata?.height || null, room: entry.room, caption: entry.caption });
      entry.status = "complete";
      entry.progress = 100;
      this.queue = this.queue.filter((candidate) => candidate !== entry);
      await this.refresh(`${entry.mediaKind === "video" ? "Video" : "Photo"} uploaded and added to the private packet.`);
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
      if (!confirm("Remove this media item from the draft walkthrough?")) return;
      if (!FIXTURE_MODE) await ownerApi("delete_item", { item_id: mediaCard.dataset.itemId });
      this.packet.items = this.packet.items.filter((item) => item.id !== mediaCard.dataset.itemId);
      this.message = "Media removed from the draft."; this.render(); return;
    }
    if (action === "confirm-tenant-evidence" && mediaCard) {
      if (!FIXTURE_MODE) await ownerApi("confirm_tenant_evidence", { item_id: mediaCard.dataset.itemId });
      await this.refresh("Tenant condition evidence accepted and locked."); return;
    }
    if (action === "release") {
      if (!confirm("Freeze this packet and release it to the tenant now? Source media and timestamps can no longer be changed.")) return;
      if (!FIXTURE_MODE) await ownerApi("send", { inspection_id: this.packet.inspection_id });
      await this.refresh("Walkthrough media released to the tenant."); return;
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
    this.message = "Media order saved.";
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

function readMediaMetadata(file, mediaKind) {
  const capturedAt = file.lastModified ? new Date(file.lastModified).toISOString() : null;
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("media metadata could not be read"));
    }, 15000);
    const done = (value) => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve({ ...value, capturedAt });
    };
    if (mediaKind === "video") {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => done({
        durationMs: Math.round(Number(video.duration || 0) * 1000),
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      });
      video.onerror = () => {
        window.clearTimeout(timer);
        URL.revokeObjectURL(url);
        reject(new Error("video metadata could not be read"));
      };
      video.src = url;
      return;
    }
    const image = new Image();
    image.onload = () => done({ durationMs: null, width: image.naturalWidth || null, height: image.naturalHeight || null });
    image.onerror = () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error("photo metadata could not be read"));
    };
    image.src = url;
  });
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "0 B";
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDuration(value) {
  const seconds = Math.max(0, Math.round(Number(value || 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatTimestamp(value) {
  if (!value) return "Not supplied";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not supplied";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(parsed);
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
function syncOwnerMediaCta(itemCount = 0) {
  window.__onehomeOwnerMediaCount = itemCount;
  const button = [...document.querySelectorAll("button")].find((node) => /Check for photos|Buscar fotos|View Walkthrough Photos|Ver fotos del acta|No walkthrough media yet/i.test(node.textContent || ""));
  if (!button) return;
  button.disabled = false;
  button.textContent = itemCount ? "View Walkthrough Photos" : "No walkthrough media yet — upload below";
  button.dataset.ohqaOwnerMediaCta = "true";
  let note = button.parentElement?.querySelector("[data-ohqa-media-status]");
  if (!note && button.parentElement) {
    note = document.createElement("p");
    note.dataset.ohqaMediaStatus = "true";
    note.className = "mt-2 text-[12px] opacity-70";
    button.insertAdjacentElement("afterend", note);
  }
  if (note) note.textContent = itemCount
    ? `${itemCount} private walkthrough item${itemCount === 1 ? "" : "s"} ready to view.`
    : "No photos or videos have been uploaded. Nothing is visible to the tenant or public listing.";
}

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
  syncOwnerMediaCta(packet.items?.length || 0);
  if (OWNER_MEDIA_MODE) window.setTimeout(() => host.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
}

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("button");
  if (!button) return;
  if (button.dataset.ohqaOwnerMediaCta === "true" || /Check for photos|Buscar fotos|View Walkthrough Photos|Ver fotos del acta|No walkthrough media yet/i.test(button.textContent || "")) {
    const uploader = document.querySelector("#onehome-owner-media");
    if (uploader) {
      event.preventDefault();
      event.stopImmediatePropagation();
      uploader.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
  if (!window.__onehomeUploaderHasUnsettled?.()) return;
  if (/Send to Tenant|Enviar al inquilino|Send in OneHome Messages|Enviar en Mensajes/i.test(button.textContent || "")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    document.querySelector("#onehome-owner-media")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}, true);

function updateResendControl(button, status) {
  window.clearInterval(signupState.resendTimer);
  const tick = () => {
    const seconds = Math.max(0, Math.ceil(((signupState.resendAvailableAt || 0) - Date.now()) / 1000));
    const section = button.closest("section");
    const captchaHost = section?.querySelector("#ohqa-resend-captcha");
    if (captchaHost) captchaHost.hidden = seconds > 0;
    if (!seconds && section) mountResendCaptcha(section, button, status);
    button.disabled = signupState.resendBusy || seconds > 0 || !signupState.resendCaptchaToken;
    button.textContent = seconds > 0
      ? tr(`Resend code in ${seconds}s`, `Reenviar código en ${seconds}s`)
      : tr("Resend code", "Reenviar código");
    if (!seconds) window.clearInterval(signupState.resendTimer);
  };
  tick();
  signupState.resendTimer = window.setInterval(tick, 1000);
  status.hidden = !status.textContent;
}

function mountResendCaptcha(section, button, status) {
  let host = section.querySelector("#ohqa-resend-captcha");
  if (!host) {
    host = document.createElement("div");
    host.id = "ohqa-resend-captcha";
    host.className = "mt-2 flex justify-center";
    button.insertAdjacentElement("beforebegin", host);
  }
  host.hidden = false;
  if (signupState.resendWidgetId != null || !window.turnstile) return;
  try {
    signupState.resendWidgetId = window.turnstile.render(host, {
      sitekey: ONEHOME_TURNSTILE_SITE_KEY,
      theme: "auto",
      callback: (token) => {
        signupState.resendCaptchaToken = token;
        updateResendControl(button, status);
      },
      "expired-callback": () => {
        signupState.resendCaptchaToken = "";
        updateResendControl(button, status);
      },
      "error-callback": () => {
        signupState.resendCaptchaToken = "";
        status.textContent = tr("The human check could not load. Reload and try again.", "No se pudo cargar la verificación humana. Recargue e intente de nuevo.");
        updateResendControl(button, status);
      },
    });
  } catch { /* The shared Turnstile script may still be loading. */ }
}

async function resendOwnerSignupCode(button, status) {
  const email = signupState.email?.trim().toLowerCase() || "";
  const captchaToken = signupState.resendCaptchaToken || "";
  if (!email || !captchaToken || signupState.resendBusy || Date.now() < (signupState.resendAvailableAt || 0)) return;
  signupState.resendBusy = true;
  status.textContent = "";
  updateResendControl(button, status);
  try {
    const response = await fetch(`${ONEHOME_SUPABASE_URL}/auth/v1/otp`, {
      method: "POST",
      headers: { apikey: ONEHOME_ANON_KEY, Authorization: `Bearer ${ONEHOME_ANON_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        email,
        create_user: true,
        gotrue_meta_security: { captcha_token: captchaToken },
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.msg || result.message || result.error_description || result.error || tr("The code could not be resent.", "No se pudo reenviar el código."));
    signupState.resendAvailableAt = Date.now() + 60000;
    status.textContent = tr("A new code was sent.", "Se envió un código nuevo.");
  } catch (error) {
    status.textContent = error?.message || String(error);
  } finally {
    signupState.resendCaptchaToken = "";
    if (signupState.resendWidgetId != null && window.turnstile) {
      try { window.turnstile.remove(signupState.resendWidgetId); } catch { /* Widget may have expired. */ }
    }
    signupState.resendWidgetId = null;
    signupState.resendBusy = false;
    updateResendControl(button, status);
  }
}

function mountVerificationPage() {
  const code = document.querySelector('input[autocomplete="one-time-code"]');
  if (!code) {
    document.body.classList.remove("ohqa-verification-page");
    document.querySelector(".ohqa-verification-card")?.classList.remove("ohqa-verification-card");
    window.clearInterval(signupState.resendTimer);
    return;
  }
  const section = code.closest("section");
  if (!section) return;
  if (!signupState.email) {
    signupState.email = section.textContent?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || "";
  }
  document.body.classList.add("ohqa-verification-page");
  section.classList.add("ohqa-verification-card");
  const heading = section.querySelector("h2");
  const headingText = tr("Check your email", "Revise su correo");
  if (heading && heading.textContent !== headingText) heading.textContent = headingText;
  const changeEmail = [...section.querySelectorAll("button")].find((button) => /Use a different email|Usar otro correo/i.test(button.textContent || ""));
  if (!changeEmail || section.querySelector("#ohqa-resend-code")) return;
  const resend = document.createElement("button");
  resend.id = "ohqa-resend-code";
  resend.type = "button";
  resend.className = "btn-ghost mt-2 w-full";
  const status = document.createElement("p");
  status.id = "ohqa-resend-status";
  status.className = "ohqa-resend-status";
  status.setAttribute("role", "status");
  status.hidden = true;
  changeEmail.insertAdjacentElement("beforebegin", resend);
  resend.insertAdjacentElement("afterend", status);
  resend.addEventListener("click", () => void resendOwnerSignupCode(resend, status));
  updateResendControl(resend, status);
}

let observedLocale = currentLocale();
const observer = new MutationObserver(() => {
  const locale = currentLocale();
  if (locale !== observedLocale) {
    observedLocale = locale;
    document.querySelector("#ohqa-document-modal")?.remove();
    const phoneSource = document.querySelector('input[type="tel"][autocomplete="tel"]');
    if (phoneSource && !phoneSource.value) {
      phoneSource.nextElementSibling?.classList.contains("ohqa-phone-canonical") && phoneSource.nextElementSibling.remove();
      delete phoneSource.dataset.ohqaPhone;
    }
  }
  if (!FIXTURE_MODE) mountTerms();
  mountClaimedLinkGuard();
  mountCountryPhone();
  mountVerificationPage();
  syncCreateTermsGate();
  translateReviewFlow();
  void maybeMountUploader();
});
observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["lang"] });
mountTerms();
void checkClaimAvailability();
mountClaimedLinkGuard();
mountCountryPhone();
mountVerificationPage();
syncCreateTermsGate();
translateReviewFlow();
void maybeMountUploader();
