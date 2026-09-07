const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const owner = fs.readFileSync(path.join(root, "onehome-owner-qa.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const fallback = fs.readFileSync(path.join(root, "404.html"), "utf8");

for (const [name, html] of [["index", index], ["404", fallback]]) {
  assert.match(html, /oneHomeHandoff\s*=\s*\/\^\\\/rentals\\\/\(\?:review\|inspection\)/, `${name} must recognize OneHome handoff routes`);
  assert.match(html, /import\('\/onehome-review-app\.js\?v=20260906-owner-auth1'\)/, `${name} must load the review app on a handoff route`);
  assert.match(html, /else\s*\{\s*import\('\/index-CBCND54k\.js'\)/s, `${name} must preserve the current full app everywhere else`);
}

assert.match(owner, /fetch\(`\$\{ONEHOME_SUPABASE_URL\}\/auth\/v1\/signup`/, "new owners must be created with email and password before verification");
assert.match(owner, /type:\s*signupState\.verifyType\s*\|\|\s*"email"/, "verification must use signup codes for new owners and email codes for existing accounts");
assert.match(owner, /signupState\.suppressNextOtp\s*=\s*!repeatedSignup/, "the duplicate React OTP request must be suppressed for a fresh signup");
assert.match(owner, /signupResend\s*\?\s*"resend"\s*:\s*"otp"/, "resend must use the matching Supabase endpoint");
assert.doesNotMatch(owner, /\/auth\/v1\/user[\s\S]{0,300}password:/, "the verified AAL1 session must not attempt a password change");

console.log("OneHome owner route and authentication contract: PASS");
