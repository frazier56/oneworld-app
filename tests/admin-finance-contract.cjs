const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migrationName = fs.readdirSync(path.join(root, 'supabase', 'migrations'))
  .find((name) => name.endsWith('_admin_finance_evidence_summary.sql'));

assert.ok(migrationName, 'Admin finance migration must exist');

const sql = fs.readFileSync(path.join(root, 'supabase', 'migrations', migrationName), 'utf8');
const js = fs.readFileSync(path.join(root, 'admin-dashboard.js'), 'utf8');
const dashboardCss = fs.readFileSync(path.join(root, 'admin-dashboard.css'), 'utf8');
const css = fs.readFileSync(path.join(root, 'admin-parity.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'admin', 'index.html'), 'utf8');
const fixture = fs.readFileSync(path.join(root, 'tests', 'fixtures', 'admin-finance.html'), 'utf8');

assert.match(sql, /if not public\.is_platform_admin\(\)/i, 'Finance data must retain the platform-admin guard');
assert.match(sql, /security definer[\s\S]*set search_path = ''/i, 'Privileged function must use an empty search path');
assert.match(sql, /revoke all on function public\.admin_dashboard_sections\(\) from public, anon/i);
assert.match(sql, /grant execute on function public\.admin_dashboard_sections\(\) to authenticated/i);
assert.doesNotMatch(sql, /select\s+\*/i, 'Admin aggregate must name its data');

assert.match(sql, /bookings\.refund_amount|b\.refund_amount/i, 'Explicit refund amounts must come from the dedicated booking refund field');
assert.match(sql, /Agreement and event refunds are count-only/i, 'Incomplete amount coverage must be disclosed');
assert.match(sql, /'mrr', null/i, 'MRR must remain null without an approved definition');
assert.match(sql, /'status', 'definition_required'/i);
assert.match(sql, /Scheduled work and accepted monthly rent are commitments, not earned One World recurring revenue/i);
assert.doesNotMatch(sql, /onepay_refunds/i, 'Unreleased OnePay data must not enter the production Admin metric');

assert.match(js, /Confirmed refund records/);
assert.match(js, /MRR remains intentionally blank/);
assert.match(js, /Recurring source coverage/);
assert.match(js, /Recognized platform fees/);
assert.match(js, /finance \|\| \{\}/, 'UI must remain compatible while the server migration is pending');
assert.match(css, /\.owal-finance-grid/);
assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.owal-finance-grid \{ grid-template-columns: 1fr; \}/);
assert.match(html, /admin-dashboard\.js\?v=20260907-finance1/);
assert.match(html, /admin-dashboard\.css\?v=20260907-finance2/);
assert.match(html, /admin-parity\.css\?v=20260907-finance1/);
assert.match(dashboardCss, /\.ow-admin-live nav button\{min-width:0;flex:1 1 0;padding:\.68rem \.32rem\}/);
assert.match(fixture, /Local synthetic layout fixture/);
assert.match(fixture, /MRR remains intentionally blank/);
assert.match(fixture, /no authentication, database write, refund, charge, or account action/i);

console.log('Admin finance contract checks passed.');
