const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const languagePath = path.join(root, "src/products/oneevent/i18n/LanguageContext.tsx");
const languageSource = fs.readFileSync(languagePath, "utf8");
const match = languageSource.match(/const HOST_SURFACE: Record<string, Dict> = (\{[\s\S]*?\r?\n\});\r?\n\r?\nfunction humanize/);
assert.ok(match, "HOST_SURFACE dictionary was not found");
const dictionaries = vm.runInNewContext(`(${match[1]})`);

const placeholders = (value) => [...value.matchAll(/\{([^}]+)\}/g)].map((item) => item[1]).sort();
const keys = Object.keys(dictionaries.en);
assert.ok(keys.length >= 70, `expected the bounded host-surface key set; found ${keys.length}`);

for (const lang of ["es", "co", "de", "ru", "zh", "pt"]) {
  for (const key of keys) {
    const translated = dictionaries[lang]?.[key] ?? (lang === "co" ? dictionaries.es[key] : undefined);
    assert.equal(typeof translated, "string", `${lang} is missing ${key}`);
    assert.ok(translated.trim(), `${lang}.${key} is empty`);
    assert.deepEqual(placeholders(translated), placeholders(dictionaries.en[key]), `${lang}.${key} changed placeholders`);
  }
}

const expectedCalls = {
  "src/products/oneevent/pages/AppEventsHub.tsx": [
    "hub.events.manage", "hub.events.edit", "hub.events.duplicate", "hub.events.unpublish",
    "hub.events.add_calendar", "hub.events.delete", "hub.events.view_live",
  ],
  "src/products/oneevent/pages/EventManagement.tsx": [
    "mgmt.title", "mgmt.event_tools", "mgmt.edit", "mgmt.duplicate", "mgmt.share", "mgmt.delete",
  ],
  "src/products/oneevent/components/events/EventOverviewTab.tsx": [
    "mgmt.guest_list", "mgmt.assign_manager", "mgmt.capacity_summary", "mgmt.checkin_summary",
    "mgmt.paid_ticket_one", "mgmt.guest_admission_one",
  ],
  "src/products/oneevent/components/events/EventReminderSettings.tsx": [
    "reminders.title", "reminders.description", "reminders.3d_title", "reminders.channels",
    "reminders.preview_title", "reminders.preview_greeting", "reminders.preview_stop",
  ],
};

for (const [relativePath, requiredKeys] of Object.entries(expectedCalls)) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const key of requiredKeys) assert.ok(source.includes(`\"${key}\"`), `${relativePath} does not use ${key}`);
}

const registrations = fs.readFileSync(path.join(root, "src/products/oneevent/components/events/EventRegistrationsTab.tsx"), "utf8");
assert.ok(registrations.includes('m("Attendee actions", "Acciones del asistente")'), "registration action label is not localized");

console.log(`PASS OneEvent host management locales: ${keys.length} keys × 6 non-English locales, placeholders and call sites`);
