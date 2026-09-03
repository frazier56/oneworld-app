const OHW_SUPABASE_URL = "https://wseblryyqxawvbjmylbo.supabase.co";
const OHW_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZWJscnl5cXhhd3Ziam15bGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDU4NjksImV4cCI6MjA5MzUyMTg2OX0.y2yfMwSC_eh_jzI5eXsp6qD5zkl0OICtESV070EhRQM";
const OHW_API = `${OHW_SUPABASE_URL}/functions/v1/rental-inspection`;
const OHW_TOKEN = location.pathname.match(/^\/rentals\/inspection\/([0-9a-f]{48})\/?$/i)?.[1]?.toLowerCase() || "";
const OHW_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const OHW_HEADERS = { apikey: OHW_ANON_KEY, Authorization: `Bearer ${OHW_ANON_KEY}` };

const ohwState = {
  packet: null,
  mode: "single",
  index: 0,
  busyItem: "",
  rejectItem: "",
  rejectComment: "",
  rejectFile: null,
  progress: 0,
  error: "",
};

function ohwEl(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function ohwTime(value) {
  if (!value) return "Not recorded";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).format(new Date(value));
  } catch { return String(value); }
}

function ohwBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MiB`;
  return `${Math.ceil(bytes / 1024)} KiB`;
}

function ohwDuration(value) {
  const seconds = Math.round(Number(value || 0) / 1000);
  if (!seconds) return "";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

async function ohwRequest(payload) {
  const response = await fetch(OHW_API, {
    method: "POST",
    headers: { ...OHW_HEADERS, "content-type": "application/json" },
    body: JSON.stringify({ ...payload, t: OHW_TOKEN }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "That request could not be completed.");
  return body;
}

async function ohwLoad() {
  const response = await fetch(`${OHW_API}?t=${encodeURIComponent(OHW_TOKEN)}`, { headers: OHW_HEADERS });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "This walkthrough could not be opened.");
  ohwState.packet = body;
  ohwState.index = Math.min(ohwState.index, Math.max(0, body.items.length - 1));
}

function ohwMedia(item, compact = false) {
  const wrap = ohwEl("div", compact ? "ohw-media ohw-media--compact" : "ohw-media");
  if (!item.photo_url) {
    wrap.append(ohwEl("p", "ohw-media-error", "This private media item is unavailable. Ask the listing agent to check it."));
    return wrap;
  }
  if (item.media_kind === "video") {
    const video = document.createElement("video");
    video.src = item.photo_url;
    video.controls = !compact;
    video.muted = compact;
    video.playsInline = true;
    video.preload = compact ? "metadata" : "auto";
    video.setAttribute("aria-label", item.note || `Walkthrough video ${item.ordinal}`);
    wrap.append(video);
  } else {
    const image = document.createElement("img");
    image.src = item.photo_url;
    image.alt = item.note || `Walkthrough photo ${item.ordinal}`;
    image.loading = compact ? "lazy" : "eager";
    wrap.append(image);
  }
  return wrap;
}

function ohwStatus(item) {
  if (item.verdict === "agreed") return ohwEl("span", "ohw-status ohw-status--approved", "✓ Approved");
  if (item.verdict === "disputed") return ohwEl("span", "ohw-status ohw-status--rejected", "✕ Rejected");
  return ohwEl("span", "ohw-status", "Awaiting review");
}

function ohwMetadata(item) {
  const meta = ohwEl("dl", "ohw-meta");
  const fields = [
    ["Captured by agent", ohwTime(item.captured_at)],
    ["Uploaded by agent", ohwTime(item.uploaded_at)],
    ["Source version", String(item.source_version || 1)],
    ["File", [ohwBytes(item.byte_size), ohwDuration(item.duration_ms)].filter(Boolean).join(" · ") || "Recorded"],
  ];
  for (const [label, value] of fields) {
    const group = ohwEl("div");
    group.append(ohwEl("dt", "", label), ohwEl("dd", "", value));
    meta.append(group);
  }
  return meta;
}

function ohwTenantEvidence(item) {
  if (!item.tenant_photo) return null;
  const section = ohwEl("section", "ohw-evidence");
  section.append(ohwEl("h3", "", "Tenant actual-condition photo"));
  if (item.tenant_photo.url) {
    const image = document.createElement("img");
    image.src = item.tenant_photo.url;
    image.alt = "Tenant actual condition tied to this walkthrough item";
    section.append(image);
  }
  section.append(ohwEl("p", "ohw-caption", `Uploaded ${ohwTime(item.tenant_photo.uploaded_at)}`));
  if (item.tenant_evidence_status === "accepted") {
    section.append(ohwEl("p", "ohw-locked", `✓ Confirmed and locked ${ohwTime(item.tenant_evidence_locked_at)}`));
  } else {
    section.append(ohwEl("p", "ohw-pending", "Awaiting listing-agent confirmation"));
  }
  return section;
}

function ohwFileInput(item) {
  const label = ohwEl("label", "ohw-file");
  label.append(ohwEl("span", "", "Actual-condition photo (optional)"));
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/webp,image/heic,image/heif";
  input.addEventListener("change", () => {
    const file = input.files?.[0] || null;
    ohwState.error = "";
    if (file && (!OHW_IMAGE_TYPES.has(file.type.toLowerCase()) || file.size < 1 || file.size > 26214400)) {
      ohwState.rejectFile = null;
      ohwState.error = "Use one JPG, PNG, WebP, HEIC, or HEIF photo no larger than 25 MiB.";
    } else {
      ohwState.rejectFile = file;
    }
    ohwRender();
  });
  label.append(input);
  if (ohwState.rejectFile) label.append(ohwEl("small", "", `${ohwState.rejectFile.name} · ${ohwBytes(ohwState.rejectFile.size)}`));
  return label;
}

function ohwUpload(signedUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("apikey", OHW_ANON_KEY);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("The condition photo upload was interrupted."));
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error("The secure condition photo could not be uploaded."));
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    xhr.send(form);
  });
}

async function ohwRespond(item, verdict) {
  if (ohwState.busyItem || item.verdict !== "pending") return;
  if (verdict === "disputed" && !ohwState.rejectComment.trim()) {
    ohwState.error = "A rejection comment is required.";
    ohwRender();
    return;
  }
  ohwState.busyItem = item.id;
  ohwState.error = "";
  ohwState.progress = 0;
  let uploadedPath = "";
  try {
    if (verdict === "disputed" && ohwState.rejectFile) {
      const file = ohwState.rejectFile;
      const ticket = await ohwRequest({
        action: "tenant_upload_ticket",
        item_id: item.id,
        mime_type: file.type.toLowerCase(),
        byte_size: file.size,
      });
      uploadedPath = ticket.path;
      await ohwUpload(ticket.signed_url, file, (progress) => {
        ohwState.progress = progress;
        const meter = document.querySelector("#ohw-upload-progress");
        if (meter) meter.value = progress;
        const label = document.querySelector("#ohw-upload-label");
        if (label) label.textContent = `Uploading actual-condition photo… ${progress}%`;
      });
    }
    await ohwRequest({
      action: "respond_item",
      item_id: item.id,
      verdict,
      note: verdict === "disputed" ? ohwState.rejectComment.trim() : "",
      tenant_photo_path: uploadedPath || null,
      tenant_photo_original_name: ohwState.rejectFile?.name || null,
      tenant_photo_captured_at: ohwState.rejectFile ? new Date(ohwState.rejectFile.lastModified).toISOString() : null,
    });
    ohwState.rejectItem = "";
    ohwState.rejectComment = "";
    ohwState.rejectFile = null;
    await ohwLoad();
  } catch (error) {
    if (uploadedPath) {
      await ohwRequest({ action: "tenant_cleanup_upload", item_id: item.id, storage_path: uploadedPath }).catch(() => {});
    }
    ohwState.error = error?.message || String(error);
  } finally {
    ohwState.busyItem = "";
    ohwState.progress = 0;
    ohwRender();
  }
}

function ohwReviewControls(item) {
  const controls = ohwEl("div", "ohw-review");
  if (item.verdict === "agreed") {
    controls.append(ohwEl("p", "ohw-result ohw-result--approved", `✓ You approved this item at ${ohwTime(item.responded_at)}. This response is closed.`));
    return controls;
  }
  if (item.verdict === "disputed") {
    controls.append(ohwEl("p", "ohw-result ohw-result--rejected", `✕ Rejected at ${ohwTime(item.responded_at)}. This response is closed.`));
    if (item.tenant_note) controls.append(ohwEl("blockquote", "", item.tenant_note));
    const evidence = ohwTenantEvidence(item);
    if (evidence) controls.append(evidence);
    return controls;
  }
  if (ohwState.rejectItem === item.id) {
    const title = ohwEl("h3", "", "Reject this item");
    const help = ohwEl("p", "ohw-caption", "Explain what differs from the property's actual condition. Your comment is required and becomes part of the audit record.");
    const textarea = document.createElement("textarea");
    textarea.placeholder = "Required: describe the difference";
    textarea.maxLength = 2000;
    textarea.value = ohwState.rejectComment;
    textarea.addEventListener("input", () => {
      ohwState.rejectComment = textarea.value;
      const send = controls.querySelector(".ohw-button--danger");
      if (send) send.disabled = Boolean(ohwState.busyItem) || !textarea.value.trim();
    });
    controls.append(title, help, textarea, ohwFileInput(item));
    if (ohwState.busyItem === item.id && ohwState.rejectFile) {
      const label = ohwEl("label", "ohw-progress", `Uploading actual-condition photo… ${ohwState.progress}%`);
      label.id = "ohw-upload-label";
      const meter = document.createElement("progress");
      meter.id = "ohw-upload-progress";
      meter.max = 100;
      meter.value = ohwState.progress;
      label.append(meter);
      controls.append(label);
    }
    const row = ohwEl("div", "ohw-actions");
    const cancel = ohwEl("button", "ohw-button ohw-button--secondary", "Cancel");
    cancel.type = "button";
    cancel.disabled = Boolean(ohwState.busyItem);
    cancel.addEventListener("click", () => {
      ohwState.rejectItem = ""; ohwState.rejectComment = ""; ohwState.rejectFile = null; ohwState.error = ""; ohwRender();
    });
    const send = ohwEl("button", "ohw-button ohw-button--danger", ohwState.busyItem ? "Submitting…" : "✕ Submit rejection");
    send.type = "button";
    send.disabled = Boolean(ohwState.busyItem) || !ohwState.rejectComment.trim();
    send.addEventListener("click", () => ohwRespond(item, "disputed"));
    row.append(cancel, send);
    controls.append(row);
    return controls;
  }
  const copy = ohwEl("p", "ohw-caption", "Review the original media, then choose one response. Your response cannot be edited after submission.");
  const row = ohwEl("div", "ohw-actions");
  const approve = ohwEl("button", "ohw-button", ohwState.busyItem === item.id ? "Saving…" : "✓ Approve");
  approve.type = "button";
  approve.disabled = Boolean(ohwState.busyItem);
  approve.addEventListener("click", () => ohwRespond(item, "agreed"));
  const reject = ohwEl("button", "ohw-button ohw-button--danger-outline", "✕ Reject");
  reject.type = "button";
  reject.disabled = Boolean(ohwState.busyItem);
  reject.addEventListener("click", () => { ohwState.rejectItem = item.id; ohwState.error = ""; ohwRender(); });
  row.append(approve, reject);
  controls.append(copy, row);
  return controls;
}

function ohwSingle(items) {
  const item = items[ohwState.index];
  const article = ohwEl("article", "ohw-item");
  const head = ohwEl("div", "ohw-item-head");
  head.append(ohwEl("strong", "", `${item.media_kind === "video" ? "Video" : "Photo"} ${ohwState.index + 1} of ${items.length}`), ohwStatus(item));
  article.append(head, ohwMedia(item));
  const body = ohwEl("div", "ohw-item-body");
  if (item.room) body.append(ohwEl("p", "ohw-room", item.room));
  if (item.note) body.append(ohwEl("p", "ohw-note", item.note));
  body.append(ohwMetadata(item));
  if (ohwState.error) body.append(ohwEl("p", "ohw-error", ohwState.error));
  body.append(ohwReviewControls(item));
  const nav = ohwEl("div", "ohw-nav");
  const previous = ohwEl("button", "ohw-button ohw-button--secondary", "← Previous");
  previous.disabled = ohwState.index === 0;
  previous.addEventListener("click", () => { ohwState.index -= 1; ohwState.error = ""; ohwRender(); scrollTo({ top: 0, behavior: "smooth" }); });
  const next = ohwEl("button", "ohw-button ohw-button--secondary", "Next →");
  next.disabled = ohwState.index === items.length - 1;
  next.addEventListener("click", () => { ohwState.index += 1; ohwState.error = ""; ohwRender(); scrollTo({ top: 0, behavior: "smooth" }); });
  nav.append(previous, next);
  body.append(nav);
  article.append(body);
  return article;
}

function ohwGallery(items) {
  const grid = ohwEl("div", "ohw-gallery");
  items.forEach((item, index) => {
    const button = ohwEl("button", "ohw-thumb");
    button.type = "button";
    button.append(ohwMedia(item, true));
    const footer = ohwEl("span", "ohw-thumb-label");
    footer.append(ohwEl("strong", "", `${index + 1}. ${item.media_kind === "video" ? "Video" : "Photo"}`), ohwStatus(item));
    button.append(footer);
    button.addEventListener("click", () => { ohwState.index = index; ohwState.mode = "single"; ohwState.error = ""; ohwRender(); scrollTo({ top: 0, behavior: "smooth" }); });
    grid.append(button);
  });
  return grid;
}

async function ohwApproveAll() {
  if (ohwState.busyItem) return;
  ohwState.busyItem = "complete";
  ohwState.error = "";
  ohwRender();
  try {
    await ohwRequest({ action: "approve" });
    await ohwLoad();
  } catch (error) {
    ohwState.error = error?.message || String(error);
  } finally {
    ohwState.busyItem = "";
    ohwRender();
  }
}

function ohwSummary(items) {
  const pending = items.filter((item) => item.verdict === "pending").length;
  const rejected = items.filter((item) => item.verdict === "disputed").length;
  const approved = items.length - pending - rejected;
  const section = ohwEl("section", "ohw-summary");
  section.append(ohwEl("h2", "", "Walkthrough review"));
  section.append(ohwEl("p", "", `${approved} approved · ${rejected} rejected · ${pending} awaiting review`));
  if (ohwState.error && ohwState.busyItem === "complete") section.append(ohwEl("p", "ohw-error", ohwState.error));
  if (ohwState.packet.state === "agreed") {
    section.append(ohwEl("p", "ohw-locked", `✓ Complete and locked ${ohwTime(ohwState.packet.approved_at)}`));
    const continueButton = ohwEl("button", "ohw-button", "Continue to lease and payment");
    continueButton.addEventListener("click", () => { const url = new URL(location.href); url.searchParams.set("payment", "1"); location.assign(url); });
    section.append(continueButton);
  } else if (!pending && !rejected && items.length) {
    const complete = ohwEl("button", "ohw-button", ohwState.busyItem === "complete" ? "Locking walkthrough…" : "Approve complete walkthrough");
    complete.disabled = Boolean(ohwState.busyItem);
    complete.addEventListener("click", ohwApproveAll);
    section.append(complete);
  } else if (rejected) {
    section.append(ohwEl("p", "ohw-pending", "Rejections were sent to the listing agent. Ordinary re-upload is now closed; any follow-up stays tied to this property in OneHome Messages."));
  } else {
    section.append(ohwEl("p", "ohw-caption", "Review every item to unlock final approval."));
  }
  return section;
}

function ohwRender() {
  const root = document.querySelector("#onehome-walkthrough-media");
  if (!root || !ohwState.packet) return;
  const packet = ohwState.packet;
  const items = packet.items || [];
  root.replaceChildren();
  const main = ohwEl("main", "ohw-shell");
  const header = ohwEl("header", "ohw-header");
  header.append(ohwEl("p", "ohw-kicker", "PRIVATE MOVE-IN RECORD"));
  header.append(ohwEl("h1", "", packet.property?.title || "Walkthrough media"));
  const place = [packet.property?.neighbourhood, packet.property?.city].filter(Boolean).join(", ");
  if (place) header.append(ohwEl("p", "ohw-place", place));
  header.append(ohwEl("p", "ohw-intro", "Review each original item. Approvals and rejections are time-stamped and cannot be changed after submission."));
  header.append(ohwEl("p", "ohw-release", `Released ${ohwTime(packet.released_at)} · ${packet.release_reason === "payment" ? "payment / lease initiated" : "listing-agent early release"}`));
  main.append(header);
  const toolbar = ohwEl("div", "ohw-toolbar");
  const single = ohwEl("button", `ohw-view ${ohwState.mode === "single" ? "is-active" : ""}`, "One by one");
  single.addEventListener("click", () => { ohwState.mode = "single"; ohwRender(); });
  const gallery = ohwEl("button", `ohw-view ${ohwState.mode === "gallery" ? "is-active" : ""}`, "Gallery");
  gallery.addEventListener("click", () => { ohwState.mode = "gallery"; ohwRender(); });
  toolbar.append(single, gallery);
  main.append(toolbar);
  if (!items.length) main.append(ohwEl("p", "ohw-empty", "No walkthrough media were included."));
  else main.append(ohwState.mode === "gallery" ? ohwGallery(items) : ohwSingle(items));
  main.append(ohwSummary(items));
  root.append(main);
}

async function ohwMount() {
  if (!OHW_TOKEN || new URLSearchParams(location.search).get("payment") === "1") return;
  try {
    await ohwLoad();
  } catch {
    return; // The existing route owns unavailable/release-gated states.
  }
  const root = ohwEl("div");
  root.id = "onehome-walkthrough-media";
  document.body.append(root);
  document.body.classList.add("ohw-active");
  ohwRender();
}

ohwMount();
