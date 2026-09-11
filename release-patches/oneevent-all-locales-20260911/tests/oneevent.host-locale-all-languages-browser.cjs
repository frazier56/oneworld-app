const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const esbuild = require("esbuild");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "artifacts", "oneevent-host-locales");
fs.mkdirSync(out, { recursive: true });

const clientMock = `
const q = new URLSearchParams(location.search);
const rows = [{
  id: "fixture-broadcast",
  created_at: "2026-09-11T16:00:00Z",
  channels: ["email", "sms", "whatsapp"],
  recipient_count: 8,
  status: "completed",
  metadata: { broadcast_kind: "invite_followup", reminder_label: "3 days away" },
}];
export const supabase = {
  from: () => ({ select(){return this}, eq(){return this}, order(){return this}, async limit(){return {data:rows,error:null}} }),
  functions: { invoke: async (_, args) => {
    const channel = args.body.channel;
    return { data: { provider_stats: { attempted: 8, delivered: 6, failed: 2 }, [channel + "_recipients"]: [
      { id: "fixture-recipient", contact_name: "Synthetic Test", destination: channel === "email" ? "test@example.invalid" : "+15555550100", status: "sent", delivered_at: "2026-09-11T16:00:00Z" },
    ] }, error: null };
  } },
};`;
fs.writeFileSync(path.join(out, "client.js"), clientMock);
fs.writeFileSync(path.join(out, "shell.js"), `export const useI18n=()=>({lang:new URLSearchParams(location.search).get("lang")||"en",setLang:()=>{}});`);
fs.writeFileSync(path.join(out, "index.html"), `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>`);
const builtCss = fs.readdirSync(path.join(root, "dist")).find((name) => /^index-.*\.css$/.test(name));
assert.ok(builtCss, "production build must include the main CSS bundle");
fs.copyFileSync(path.join(root, "dist", builtCss), path.join(out, "style.css"));

esbuild.buildSync({
  stdin: {
    contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import Dialog from "@evt/components/events/EventBroadcastHistoryDialog";
      import { useMicro } from "@evt/i18n/LanguageContext";
      const RolodexFixture=()=>{const m=useMicro();return <main className="mx-auto w-full max-w-md space-y-3 p-4 text-foreground">
        <div className="flex items-stretch gap-2"><button aria-label={m("Close Rolodex")} className="min-h-11 shrink-0 rounded-full border px-4">×</button><button className="min-h-11 min-w-0 flex-1 rounded-full border px-4 py-2 text-sm font-semibold leading-tight">{m("Rolodex Tools")}</button></div>
        <div className="ml-auto w-64 max-w-full rounded-2xl border bg-card p-2 shadow-xl">
          {["Add contact","Share Rolodex","Import contacts","Broadcast History"].map(k=><button key={k} className="block min-h-11 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold">{m(k)}</button>)}
        </div>
        <label className="block"><span className="sr-only">{m("Search your Rolodex...")}</span><input className="h-11 w-full rounded-xl border px-4" placeholder={m("Search your Rolodex...")}/></label>
        <p className="text-sm">{m("Contacts are automatically added when people register for your events. You can also add connections manually.")}</p>
      </main>};
      const q=new URLSearchParams(location.search);createRoot(document.getElementById("root")).render(q.get("surface")==="rolodex"?<RolodexFixture/>:<Dialog open={true} onOpenChange={()=>{}} eventId="fixture-event" eventTimeZone="America/Bogota"/>);
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

const types = {
  de: { title: "Gesendete Einladungen", row: "Erinnerung · Noch 3 Tage", close: "Einladungsverlauf schließen", tool: "Rolodex-Werkzeuge", search: "Rolodex durchsuchen..." },
  ru: { title: "Отправленные приглашения", row: "Напоминание · Осталось дней: 3", close: "Закрыть историю рассылок", tool: "Инструменты Rolodex", search: "Поиск в Rolodex..." },
  zh: { title: "已发送邀请", row: "后续提醒 · 还有 3 天", close: "关闭邀请记录", tool: "Rolodex 工具", search: "搜索您的 Rolodex..." },
  pt: { title: "Convites enviados", row: "Lembrete · Faltam 3 dias", close: "Fechar histórico de convites", tool: "Ferramentas do Rolodex", search: "Buscar no seu Rolodex..." },
};
const viewports = [{ name: "desktop", width: 1280, height: 800 }, { name: "390", width: 390, height: 844 }, { name: "320", width: 320, height: 720 }];

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const file = path.join(out, pathname === "/" ? "index.html" : pathname);
  if (!file.startsWith(out) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader("Content-Type", file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise((resolve) => server.listen(5237, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results = [];
  try {
    for (const [lang, expected] of Object.entries(types)) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        await page.goto(`http://127.0.0.1:5237/?lang=${lang}&surface=dialog`);
        await page.getByText(expected.title, { exact: true }).waitFor();
        await page.getByRole("button", { name: expected.close }).waitFor();
        await page.locator("button[aria-expanded]").first().click();
        await page.getByText(expected.row, { exact: false }).first().waitFor();
        const layout = await page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]');
          const rect = dialog?.getBoundingClientRect();
          const metricLabels = [...document.querySelectorAll("button p")].filter((node) => getComputedStyle(node).textTransform === "uppercase");
          return {
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
            dialogInsideViewport: !!rect && rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1,
            metricOverflow: metricLabels.some((node) => node.scrollWidth > node.clientWidth + 1),
          };
        });
        assert.equal(layout.horizontalOverflow, false, `${lang}/${viewport.name}: page must not overflow horizontally`);
        assert.equal(layout.dialogInsideViewport, true, `${lang}/${viewport.name}: dialog must stay inside viewport`);
        assert.equal(layout.metricOverflow, false, `${lang}/${viewport.name}: metric labels must fit`);
        assert.deepEqual(errors, [], `${lang}/${viewport.name}: no page errors`);
        await page.screenshot({ path: path.join(out, `${lang}-${viewport.name}-dialog.png`) });
        await page.goto(`http://127.0.0.1:5237/?lang=${lang}&surface=rolodex`);
        await page.getByText(expected.tool, { exact: true }).waitFor();
        await page.getByPlaceholder(expected.search).waitFor();
        await page.evaluate(() => window.scrollTo(0, 0));
        const rolodexLayout = await page.evaluate(() => ({ horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 }));
        assert.equal(rolodexLayout.horizontalOverflow, false, `${lang}/${viewport.name}: Rolodex surface must not overflow horizontally`);
        assert.deepEqual(errors, [], `${lang}/${viewport.name}: no Rolodex page errors`);
        await page.screenshot({ path: path.join(out, `${lang}-${viewport.name}-rolodex.png`) });
        results.push({ lang, viewport: viewport.name, dialog: "pass", rolodex: "pass", ...layout });
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ synthetic: true, browser: "Microsoft Edge", results }, null, 2));
  console.log(`PASS ${results.length} locale/viewport pairs across exact dialog and adjacent Rolodex fixtures`);
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
