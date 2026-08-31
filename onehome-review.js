const API = "https://wseblryyqxawvbjmylbo.supabase.co/functions/v1/listing-review";
const token = location.pathname.match(/^\/rentals\/review\/([a-f0-9]{48})\/?$/i)?.[1] || "";

const words = {
  en: {
    sent: "Sent to you by", review: "Review this home", intro: "Please check the photos, description and terms. If everything is right, approve below.",
    month: "month", included: "Included in the rent", fee: "Move-in fee", feeWhen: "Charged when the lease starts, not now.", details: "Home details",
    gallery: "Photos", more: "Show all photos", less: "Show fewer photos", terms: "Photos, description and terms", name: "Your name", note: "Note for Lee (optional)",
    approve: "Approve", changes: "Request changes", confirm: "Confirm approval", irreversible: "Once approved, this cannot be undone.", yes: "Yes, approve", back: "Go back",
    changeRequired: "Please say what needs changing.", nameRequired: "Please add your name.", approved: "Approved", saved: "Your approval was saved.",
    account: "Create your OneHome account and enter your own email to continue with the lease.", create: "Create my account", changeSaved: "Changes requested",
    changeSent: "Lee received your note and can correct the listing and send it again.", inactive: "This review link is no longer active.", retry: "Please ask Lee for a current link.",
    rentRule: "The stated rent and included utilities are correct.", photoRule: "The photos and description accurately show the apartment.", oneApproval: "One approval covers the photos, description and these terms.",
    bedrooms: "bedrooms", bathrooms: "bathrooms", furnished: "Furnished", parking: "parking", close: "Close", previous: "Previous photo", next: "Next photo"
  },
  es: {
    sent: "Enviado por", review: "Revise este inmueble", intro: "Revise las fotos, la descripción y los términos. Si todo está correcto, apruebe abajo.",
    month: "mes", included: "Incluido en el arriendo", fee: "Cargo de ingreso", feeWhen: "Se cobra cuando empieza el contrato, no ahora.", details: "Detalles del inmueble",
    gallery: "Fotos", more: "Ver todas las fotos", less: "Ver menos fotos", terms: "Fotos, descripción y términos", name: "Su nombre", note: "Nota para Lee (opcional)",
    approve: "Aprobar", changes: "Pedir cambios", confirm: "Confirmar aprobación", irreversible: "Una vez aprobado, no se puede deshacer.", yes: "Sí, aprobar", back: "Volver",
    changeRequired: "Diga qué debe cambiar.", nameRequired: "Agregue su nombre.", approved: "Aprobado", saved: "Su aprobación fue guardada.",
    account: "Cree su cuenta OneHome e ingrese su propio correo para continuar con el contrato.", create: "Crear mi cuenta", changeSaved: "Cambios solicitados",
    changeSent: "Lee recibió su nota y puede corregir el anuncio y enviarlo de nuevo.", inactive: "Este enlace de revisión ya no está activo.", retry: "Pídale a Lee un enlace vigente.",
    rentRule: "El canon y los servicios incluidos son correctos.", photoRule: "Las fotos y la descripción muestran correctamente el apartamento.", oneApproval: "Una aprobación cubre las fotos, la descripción y estos términos.",
    bedrooms: "habitaciones", bathrooms: "baños", furnished: "Amoblado", parking: "parqueadero", close: "Cerrar", previous: "Foto anterior", next: "Foto siguiente"
  }
};

let lang = "en";
let packet = null;
let expanded = false;
let lightboxIndex = 0;
const root = document.getElementById("root");

const esc = (value = "") => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const W = key => words[lang][key];
const cop = value => `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(value) || 0)} COP`;
const utilityLabels = {
  water: ["Water", "Agua"], electricity: ["Electricity", "Electricidad"], gas: ["Gas", "Gas"], internet: ["Internet", "Internet"],
  tv: ["Television", "Televisión"], administration: ["Building administration", "Administración"]
};

function shell(content) {
  root.innerHTML = `<main class="oh-review"><header class="oh-top"><a class="oh-brand" href="/rentals" aria-label="OneHome"><span class="oh-mark">O</span><span>OneHome</span></a><button id="language" class="oh-language">${lang === "en" ? "ES" : "EN"}</button></header>${content}</main>`;
  document.getElementById("language")?.addEventListener("click", () => { lang = lang === "en" ? "es" : "en"; render(); });
}

function loading() {
  shell(`<div class="oh-wrap"><div class="oh-shimmer oh-hero"></div><div class="oh-shimmer oh-line"></div><div class="oh-shimmer oh-card"></div></div>`);
}

function inactive(message = "") {
  shell(`<section class="oh-empty"><div class="oh-empty-icon">!</div><h1>${W("inactive")}</h1><p>${esc(message || W("retry"))}</p></section>`);
}

function render() {
  if (!packet?.listing) return inactive();
  const p = packet.listing;
  const photos = Array.isArray(p.photos) ? p.photos : [];
  const shown = expanded ? photos : photos.slice(0, 6);
  const facts = [
    p.bedrooms != null && `${p.bedrooms} ${W("bedrooms")}`,
    p.bathrooms != null && `${p.bathrooms} ${W("bathrooms")}`,
    p.area_m2 != null && `${p.area_m2} m²`,
    p.furnished && W("furnished"),
    p.parking_spaces != null && `${p.parking_spaces} ${W("parking")}`
  ].filter(Boolean);
  const address = [p.address_line, p.neighbourhood, p.city].filter(Boolean).join(", ");
  const utilities = (p.utilities_included || []).map(key => utilityLabels[key]?.[lang === "en" ? 0 : 1] || key);
  const decision = packet.review_decision;

  shell(`<div class="oh-wrap">
    <section class="oh-from"><span class="oh-avatar">${esc((packet.invited_by_name || "L")[0])}</span><div><small>${W("sent")}</small><strong>${esc(packet.invited_by_name || "Lee")}</strong><p>${esc(packet.note || "")}</p></div></section>
    <section class="oh-hero" style="background-image:url('${esc(photos[0] || "")}')"><div class="oh-scrim"><div><h1>${esc(p.title)}</h1><p>${esc(facts.slice(0,3).join(" · "))}</p></div><div class="oh-hero-price"><strong>${cop(p.price)}</strong><span>/ ${W("month")}</span><small>${esc(p.city || "")}</small></div></div></section>
    <section class="oh-summary"><p class="oh-address">⌖ ${esc(address)}</p><div class="oh-facts">${facts.map(f => `<span>${esc(f)}</span>`).join("")}</div>
      <div class="oh-pricing"><div><span>${W("month")}</span><strong>${cop(p.price)}</strong></div>${p.move_in_fee ? `<div><span>${esc(p.move_in_fee_note || W("fee"))}</span><strong>${cop(p.move_in_fee)}</strong></div><p>${W("feeWhen")}</p>` : ""}</div>
    </section>
    ${utilities.length ? `<section class="oh-section"><h2>${W("included")}</h2><div class="oh-chips">${utilities.map(u => `<span>✓ ${esc(u)}</span>`).join("")}</div></section>` : ""}
    <section class="oh-section"><h2>${W("gallery")} <small>${photos.length}</small></h2><div class="oh-gallery">${shown.map((src,i) => `<button class="oh-photo" data-photo="${i}"><img src="${esc(src)}" alt="${esc(p.title)} photo ${i+1}" loading="${i < 3 ? "eager" : "lazy"}"></button>`).join("")}</div>${photos.length > 6 ? `<button id="showPhotos" class="oh-outline">${expanded ? W("less") : W("more")}</button>` : ""}</section>
    <section class="oh-section"><h2>${W("details")}</h2><p class="oh-description">${esc(p.description || "").replace(/\n/g,"<br>")}</p></section>
    <section class="oh-review-card">${decision ? resultCard(decision) : reviewForm(p)}</section>
  </div><div id="overlay"></div>`);

  document.querySelectorAll("[data-photo]").forEach(button => button.addEventListener("click", () => openLightbox(Number(button.dataset.photo))));
  document.getElementById("showPhotos")?.addEventListener("click", () => { expanded = !expanded; render(); });
  bindReview();
}

function reviewForm(p) {
  return `<h2>${W("review")}</h2><p>${W("intro")}</p><div class="oh-rent-callout">${esc(packet.invited_by_name || "Lee")} sends <strong>${cop(p.price)}</strong> today — the full month’s rent.</div>
    <details><summary>${W("terms")}</summary><ul><li>${W("photoRule")}</li><li>${W("rentRule")}</li><li>${W("oneApproval")}</li></ul></details>
    <label>${W("name")} *<input id="reviewName" autocomplete="name"></label><label>${W("note")}<textarea id="reviewNote" rows="4"></textarea></label>
    <p id="formError" class="oh-error" role="alert"></p><p class="oh-warning">${W("irreversible")}</p>
    <button id="approve" class="oh-primary">${W("approve")}</button><button id="changes" class="oh-outline">${W("changes")}</button>`;
}

function resultCard(decision) {
  if (decision === "changes_requested") return `<div class="oh-result"><span>✓</span><h2>${W("changeSaved")}</h2><p>${W("changeSent")}</p></div>`;
  return `<div class="oh-result"><span>✓</span><h2>${W("approved")}</h2><p>${W("saved")}</p><p>${W("account")}</p><a class="oh-primary" href="/rentals/profile">${W("create")}</a></div>`;
}

function bindReview() {
  document.getElementById("approve")?.addEventListener("click", () => {
    const name = document.getElementById("reviewName").value.trim();
    if (name.length < 2) return error(W("nameRequired"));
    const overlay = document.getElementById("overlay");
    overlay.innerHTML = `<div class="oh-modal-bg"><div class="oh-modal"><h2>${W("confirm")}</h2><p><strong>${cop(packet.listing.price)}</strong></p><p class="oh-warning">${W("irreversible")}</p><button id="confirmApprove" class="oh-primary">${W("yes")}</button><button id="cancelApprove" class="oh-outline">${W("back")}</button></div></div>`;
    document.getElementById("confirmApprove").onclick = () => submit("approved");
    document.getElementById("cancelApprove").onclick = () => overlay.innerHTML = "";
  });
  document.getElementById("changes")?.addEventListener("click", () => submit("changes_requested"));
}

function error(message) { const el = document.getElementById("formError"); if (el) el.textContent = message; }

async function submit(decision) {
  const name = document.getElementById("reviewName")?.value.trim() || "";
  const note = document.getElementById("reviewNote")?.value.trim() || "";
  if (name.length < 2) return error(W("nameRequired"));
  if (decision === "changes_requested" && !note) return error(W("changeRequired"));
  document.querySelectorAll("button").forEach(b => b.disabled = true);
  try {
    const response = await fetch(API, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({t:token,decision,name,note}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Please try again.");
    packet.review_decision = decision;
    packet.reviewed_by_name = name;
    render();
  } catch (e) {
    document.getElementById("overlay").innerHTML = "";
    error(e.message || String(e));
    document.querySelectorAll("button").forEach(b => b.disabled = false);
  }
}

function openLightbox(index) {
  const photos = packet.listing.photos || [];
  lightboxIndex = (index + photos.length) % photos.length;
  const overlay = document.getElementById("overlay");
  overlay.innerHTML = `<div class="oh-lightbox" role="dialog" aria-modal="true"><button id="closeLightbox" aria-label="${W("close")}">×</button><button id="prevPhoto" aria-label="${W("previous")}">‹</button><img src="${esc(photos[lightboxIndex])}" alt=""><button id="nextPhoto" aria-label="${W("next")}">›</button><span>${lightboxIndex+1} / ${photos.length}</span></div>`;
  document.getElementById("closeLightbox").onclick = () => overlay.innerHTML = "";
  document.getElementById("prevPhoto").onclick = () => openLightbox(lightboxIndex - 1);
  document.getElementById("nextPhoto").onclick = () => openLightbox(lightboxIndex + 1);
}

async function start() {
  loading();
  if (!token) return inactive();
  try {
    const response = await fetch(`${API}?t=${encodeURIComponent(token)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.expired || !data.listing) throw new Error(data.message || W("retry"));
    packet = data;
    render();
  } catch (e) { inactive(e.message || W("retry")); }
}

start();
