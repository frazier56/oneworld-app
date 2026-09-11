const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const esbuild = require("esbuild");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "artifacts", "oneevent-management-locales");
fs.mkdirSync(out, { recursive: true });

fs.writeFileSync(path.join(out, "client.js"), `
const chain = {
  select(){ return this; },
  eq(){ return this; },
  async maybeSingle(){ return { data: null, error: null }; },
  async upsert(){ return { error: null }; },
};
export const supabase = { from: () => Object.create(chain) };
`);
fs.writeFileSync(path.join(out, "shell.js"), `
export const useI18n = () => ({
  lang: new URLSearchParams(location.search).get("lang") || "en",
  setLang: () => {},
});
`);
fs.writeFileSync(path.join(out, "index.html"), `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>`);

const builtCss = fs.readdirSync(path.join(root, "dist")).find((name) => /^index-.*\.css$/.test(name));
assert.ok(builtCss, "production build must include the main CSS bundle");
fs.copyFileSync(path.join(root, "dist", builtCss), path.join(out, "style.css"));

esbuild.buildSync({
  stdin: {
    contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import EventReminderSettings from "@evt/components/events/EventReminderSettings";
      import { useLanguage, useMicro } from "@evt/i18n/LanguageContext";

      const fill = (text, values) => Object.entries(values).reduce((result, [key, value]) => result.replaceAll(\`{\${key}}\`, String(value)), text);
      const Fixture = () => {
        const { t } = useLanguage();
        const m = useMicro();
        return <main className="mx-auto w-full max-w-3xl space-y-5 p-3 text-foreground sm:p-6">
          <section className="rounded-2xl border border-border bg-card p-4" data-surface="my-events">
            <h1 className="text-xl font-bold">Founders Roundtable Mastermind</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {["manage", "edit", "duplicate", "unpublish", "add_calendar", "delete"].map((key) => <button key={key} className="min-h-10 rounded-full border px-3 text-sm font-semibold">{t(\`hub.events.\${key}\`, key)}</button>)}
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-card p-4" data-surface="management">
            <div className="flex flex-wrap gap-2">
              {["title", "event_tools", "share"].map((key) => <button key={key} className="min-h-10 rounded-full border px-3 text-sm font-semibold">{t(\`mgmt.\${key}\`, key)}</button>)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button className="min-h-12 rounded-xl border p-2 text-sm">{t("mgmt.guest_list", "Guest List")}</button>
              <button className="min-h-12 rounded-xl border p-2 text-sm">{t("mgmt.assign_manager", "Assign Manager")}</button>
              <p className="rounded-xl border p-2 text-sm">{fill(t("mgmt.capacity_summary", "{filled} of {capacity} spots filled"), { filled: 24, capacity: 40 })}</p>
              <p className="rounded-xl border p-2 text-sm">{fill(t("mgmt.checkin_summary", "{checked} of {total} attendees checked in"), { checked: 20, total: 24 })}</p>
            </div>
            <button className="mt-3 min-h-11 rounded-xl border px-3" aria-label={m("Attendee actions", "Acciones del asistente")}>⋮</button>
            <EventReminderSettings
              eventId="fixture-event"
              hostId="fixture-host"
              event={{ title: "Founders Roundtable Mastermind", start_date: "2026-09-02T23:00:00Z", location: "Medellín, Colombia" }}
            />
          </section>
        </main>;
      };
      createRoot(document.getElementById("root")).render(<Fixture />);
    `,
    resolveDir: root,
    loader: "tsx",
  },
  bundle: true,
  outfile: path.join(out, "fixture.js"),
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  alias: {
    "@evt/integrations/supabase/client": path.join(out, "client.js"),
    "@evt": path.join(root, "src", "products", "oneevent"),
    "@oneworld/shell": path.join(out, "shell.js"),
  },
});

const locales = {
  en: { manage: "Manage", reminders: "Event reminders", preview: "Preview reminder", previewTitle: "WhatsApp reminder preview", close: "Close", actions: "Attendee actions" },
  es: { manage: "Administrar", reminders: "Recordatorios del evento", preview: "Vista previa", previewTitle: "Vista previa del recordatorio de WhatsApp", close: "Cerrar", actions: "Acciones del asistente" },
  co: { manage: "Administrar", reminders: "Recordatorios del evento", preview: "Vista previa", previewTitle: "Vista previa del recordatorio de WhatsApp", close: "Cerrar", actions: "Acciones del asistente" },
  de: { manage: "Verwalten", reminders: "Event-Erinnerungen", preview: "Erinnerung ansehen", previewTitle: "Vorschau der WhatsApp-Erinnerung", close: "Schließen", actions: "Teilnehmeraktionen" },
  ru: { manage: "Управлять", reminders: "Напоминания о событии", preview: "Предпросмотр", previewTitle: "Предпросмотр напоминания WhatsApp", close: "Закрыть", actions: "Действия с участником" },
  zh: { manage: "管理", reminders: "活动提醒", preview: "预览提醒", previewTitle: "WhatsApp 提醒预览", close: "关闭", actions: "参与者操作" },
  pt: { manage: "Gerenciar", reminders: "Lembretes do evento", preview: "Ver lembrete", previewTitle: "Prévia do lembrete do WhatsApp", close: "Fechar", actions: "Ações do participante" },
};
const viewports = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "390", width: 390, height: 844 },
  { name: "320", width: 320, height: 720 },
];

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const file = path.join(out, pathname === "/" ? "index.html" : pathname);
  if (!file.startsWith(out) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader("Content-Type", file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise((resolve) => server.listen(5241, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results = [];
  try {
    for (const [lang, expected] of Object.entries(locales)) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        await page.goto(`http://127.0.0.1:5241/?lang=${lang}`);
        await page.locator('[data-surface="my-events"]').getByRole("button", { name: expected.manage, exact: true }).waitFor();
        await page.getByText(expected.reminders, { exact: true }).waitFor();
        await page.getByRole("button", { name: expected.actions, exact: true }).waitFor();
        await page.getByRole("button", { name: expected.preview, exact: true }).click();
        await page.getByText(expected.previewTitle, { exact: true }).waitFor();
        await page.getByRole("button", { name: expected.close, exact: true }).waitFor();
        const layout = await page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]');
          const rect = dialog?.querySelector(".glass-modal")?.getBoundingClientRect();
          const title = dialog?.querySelector("h2")?.getBoundingClientRect();
          const close = dialog?.querySelector("button[aria-label]")?.getBoundingClientRect();
          return {
            titleClearsClose: !!title && !!close && title.right <= close.left,
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
            dialogInsideViewport: !!rect && rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1,
          };
        });
        assert.equal(layout.titleClearsClose, true, `${lang}/${viewport.name}: heading must clear close control`);
        assert.equal(layout.horizontalOverflow, false, `${lang}/${viewport.name}: page must not overflow horizontally`);
        assert.equal(layout.dialogInsideViewport, true, `${lang}/${viewport.name}: reminder preview must stay inside viewport`);
        assert.deepEqual(errors, [], `${lang}/${viewport.name}: no page errors`);
        if (lang === "co" || (viewport.name === "320" && ["de", "ru", "zh", "pt"].includes(lang))) {
          await page.screenshot({ path: path.join(out, `${lang}-${viewport.name}.png`) });
        }
        results.push({ lang, viewport: viewport.name, ...layout, status: "pass" });
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ synthetic: true, browser: "Microsoft Edge", results }, null, 2));
  console.log(`PASS ${results.length} locale/viewport pairs across My Events, Manage, Registrations action, and actual reminder preview rendering`);
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
