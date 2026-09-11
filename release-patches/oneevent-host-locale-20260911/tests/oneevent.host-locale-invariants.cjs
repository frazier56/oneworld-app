const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const dialog = read("src/products/oneevent/components/events/EventBroadcastHistoryDialog.tsx");
const hub = read("src/products/oneevent/pages/AppEventsHub.tsx");
const language = read("src/products/oneevent/i18n/LanguageContext.tsx");

assert.match(dialog, /useLanguage, useMicro/);
assert.match(dialog, /const \{ locale \} = useLanguage\(\);/);
assert.match(dialog, /const m = useMicro\(\);/);
assert.match(dialog, /new Intl\.DateTimeFormat\(locale,/);

for (const key of [
  "Broadcast Invites",
  "Broadcast History",
  "Review invite activity and refresh delivery tracking.",
  "Search for a person or tap any metric to see matching recipients.",
  "Refreshing current broadcast…",
  "Tracking could not be refreshed. Try again.",
  "Details are still updating. Refresh again in a moment.",
  "SMS shows delivery. It does not show when a text is opened.",
  "WhatsApp may show when a message is read. Link clicks are tracked.",
  "Do not email these contacts?",
]) {
  assert.ok(dialog.includes(`m("${key}")`), `dialog must localize: ${key}`);
  assert.ok(language.includes(`"${key}":`), `Spanish micro table must define: ${key}`);
}

assert.match(hub, /useLanguage, useMicro/);
assert.match(hub, /const m = useMicro\(\);/);
for (const key of [
  "Close Rolodex",
  "Rolodex Tools",
  "Add contact",
  "Share Rolodex",
  "Import contacts",
  "Search your Rolodex...",
  "Choose event",
  "Loading your Rolodex...",
  "Invite to event",
]) {
  assert.ok(hub.includes(`m("${key}")`), `Rolodex must localize: ${key}`);
  assert.ok(language.includes(`"${key}":`), `Spanish micro table must define: ${key}`);
}

for (const [key, value] of [
  ["Broadcast Invites", "Invitaciones enviadas"],
  ["Delivery success", "Entregas exitosas"],
  ["Undelivered", "No entregados"],
  ["Rolodex Tools", "Herramientas del Rolodex"],
  ["Choose event", "Elegir evento"],
]) {
  assert.ok(language.includes(`"${key}": "${value}"`), `expected Colombian Spanish copy for ${key}`);
}

console.log("PASS oneevent host Broadcast History + Rolodex locale invariants");
