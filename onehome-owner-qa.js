const ONEHOME_SUPABASE_URL = "https://wseblryyqxawvbjmylbo.supabase.co";
const ONEHOME_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZWJscnl5cXhhd3Ziam15bGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU4NjksImV4cCI6MjA5MzUyMTg2OX0.y2yfMwSC_eh_jzI5eXsp6qD5zkl0OICtESV070EhRQM";
const REVIEW_API = `${ONEHOME_SUPABASE_URL}/functions/v1/listing-review`;
const INSPECTION_API = `${ONEHOME_SUPABASE_URL}/functions/v1/rental-inspection`;
const PLATFORM_TERMS_VERSION = "oneworld-platform-owner-review-2026-09-01";
const PROPERTY_TERMS_VERSION = "onehome-property-owner-review-draft-2026-09-01-v2";
const CLAIM_TOKEN = location.pathname.match(/^\/rentals\/review\/([0-9a-f]{48})\/?$/i)?.[1]?.toLowerCase() || "";
const FIXTURE_MODE = new URLSearchParams(location.search).get("onehomeQaFixture") === "owner-media";

const termsState = window.__onehomeOwnerTerms || {
  platform: false,
  property: false,
  existingSaved: false,
  busy: false,
};
window.__onehomeOwnerTerms = termsState;

function textMatches(element, pattern) {
  return pattern.test((element?.textContent || "").trim());
}

function fieldValue(labelPattern) {
  const labels = [...document.querySelectorAll("label")];
  const label = labels.find((candidate) => textMatches(candidate, labelPattern));
  return label?.querySelector("input")?.value?.trim() || "";
}

function termsPanel() {
  const panel = document.createElement("section");
  panel.id = "onehome-separate-terms";
  panel.className = "ohqa-terms";
  panel.innerHTML = `
    <div class="ohqa-eyebrow">Two separate acknowledgments</div>
    <h3>Review platform terms and property-owner terms separately</h3>
    <p class="ohqa-muted">These acceptances are recorded independently. Checking one never accepts the other.</p>
    <details open>
      <summary>1. OneWorld / OneHome platform terms</summary>
      <p>Account use, privacy, electronic records and signatures, messaging, fees, payment-record status, support and disputes. OneWorld provides the platform; it is not the property owner or the party supplying the home.</p>
    </details>
    <label class="ohqa-check">
      <input id="ohqa-platform-terms" type="checkbox">
      <span>I agree to the OneWorld / OneHome platform terms shown above.</span>
    </label>
    <details open>
      <summary>2. Property-owner supplemental terms — current review draft</summary>
      <div class="ohqa-term-group">
        <strong>Current listing terms</strong>
        <ul>
          <li><strong>9,000,000 COP</strong> for each monthly rental period.</li>
          <li>A separate, one-time <strong>300,000 COP cleaning charge</strong> is due when the lease starts.</li>
          <li><strong>No security deposit.</strong> The start date and tenant identity are added when the tenant packet is prepared.</li>
        </ul>
      </div>
      <div class="ohqa-term-group">
        <strong>Property rules carried forward from the prior five-page contract</strong>
        <ul>
          <li>Residential, lawful use only.</li>
          <li>The furnished home and furniture are returned in the condition documented at move-in, allowing for ordinary wear.</li>
          <li>The owner handles necessary or structural repairs. The tenant handles damage caused by the tenant or guests and reports owner repairs in writing.</li>
          <li>Water, electricity, gas, internet, television and building administration are included. Extra services requested by the tenant are the tenant’s responsibility.</li>
          <li>No alterations, assignment or subletting without the owner’s prior written approval.</li>
          <li>Temporary travel is not abandonment while rent is current and personal belongings remain. A support animal is permitted; the tenant is responsible for animal-caused damage.</li>
          <li>After twelve months, any annual rent adjustment follows the prior contract’s CPI approach. Lawful late-payment and breach remedies remain subject to the final lease and applicable law.</li>
        </ul>
      </div>
      <p class="ohqa-source-note"><strong>Not copied from the old contract:</strong> its expired dates, old rent amounts, deposit, bank and payee details, portable-air-conditioner deal, signatures, identity numbers and private contact details.</p>
      <p>This acknowledgment records review only. It stays separate from OneWorld’s terms and does not sign the final lease.</p>
    </details>
    <label class="ohqa-check">
      <input id="ohqa-property-terms" type="checkbox">
      <span>I acknowledge the property-owner supplemental terms snapshot shown above.</span>
    </label>
    <p class="ohqa-terms-error" role="alert" hidden>Please check both separate acknowledgments before continuing.</p>`;
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
  return panel;
}

function mountTerms() {
  if (!CLAIM_TOKEN || document.querySelector("#onehome-separate-terms")) return;
  const headings = [...document.querySelectorAll("h2")];
  const reviewHeading = headings.find((node) => textMatches(node, /Review this home|Revise este inmueble/i));
  const accountHeading = headings.find((node) => textMatches(node, /Approved|Aprobado/i));
  if (reviewHeading) {
    const cardBody = reviewHeading.closest("section")?.querySelector("div.space-y-3") || reviewHeading.parentElement?.parentElement;
    const nameLabel = [...cardBody.querySelectorAll("label")].find((node) => textMatches(node, /Property owner's name|Nombre de la propietaria/i));
    if (nameLabel) cardBody.insertBefore(termsPanel(), nameLabel);
  } else if (accountHeading && document.querySelector("button")) {
    const createButton = [...document.querySelectorAll("button")].find((node) => textMatches(node, /Create my account|Crear mi cuenta/i));
    if (createButton) createButton.parentElement.insertBefore(termsPanel(), createButton);
  }
}

function showTermsError(message) {
  const panel = document.querySelector("#onehome-separate-terms");
  const error = panel?.querySelector(".ohqa-terms-error");
  if (error) {
    error.textContent = message || "Please check both separate acknowledgments before continuing.";
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
        locale: document.documentElement.lang || "en",
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "The acknowledgments could not be saved.");
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
  if (!/^(Approve|Aprobar|Yes, approve|Sí, aprobar|Create my account|Crear mi cuenta)$/.test(label)) return;
  if (!termsState.platform || !termsState.property) {
    event.preventDefault();
    event.stopImmediatePropagation();
    showTermsError();
    return;
  }
  if (/Create my account|Crear mi cuenta/.test(label) && !termsState.existingSaved) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (termsState.busy) return;
    const name = fieldValue(/Full name|Nombre completo/i);
    if (!name) {
      showTermsError("Add your full name before saving the acknowledgments.");
      return;
    }
    const saved = await acknowledgeExistingApproval(name);
    if (saved) button.click();
  }
}, true);

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

const observer = new MutationObserver(() => {
  if (!FIXTURE_MODE) mountTerms();
  void maybeMountUploader();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
mountTerms();
void maybeMountUploader();
