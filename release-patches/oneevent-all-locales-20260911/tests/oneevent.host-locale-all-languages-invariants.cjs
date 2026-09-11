const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const localeSource = read("src/products/oneevent/i18n/hostLocaleMicro.ts");
const contextSource = read("src/products/oneevent/i18n/LanguageContext.tsx");
const sourceFile = ts.createSourceFile("hostLocaleMicro.ts", localeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const variableInitializer = (name) => {
  let result;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) result = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  assert.ok(result, `missing ${name}`);
  return ts.isAsExpression(result) ? result.expression : result;
};

const keysNode = variableInitializer("HOST_LOCALE_KEYS");
assert.ok(ts.isArrayLiteralExpression(keysNode), "HOST_LOCALE_KEYS must remain an array literal");
const keys = keysNode.elements.map((node) => {
  assert.ok(ts.isStringLiteral(node), "HOST_LOCALE_KEYS entries must be string literals");
  return node.text;
});
assert.equal(new Set(keys).size, keys.length, "host-locale keys must be unique");

const tablesNode = variableInitializer("HOST_LOCALE_MICRO");
assert.ok(ts.isObjectLiteralExpression(tablesNode), "HOST_LOCALE_MICRO must remain an object literal");
const locales = new Map();
for (const localeProperty of tablesNode.properties) {
  assert.ok(ts.isPropertyAssignment(localeProperty), "locale entries must be property assignments");
  const locale = localeProperty.name.getText(sourceFile).replace(/["']/g, "");
  assert.ok(ts.isObjectLiteralExpression(localeProperty.initializer), `${locale} must be an object literal`);
  const values = new Map();
  for (const property of localeProperty.initializer.properties) {
    assert.ok(ts.isPropertyAssignment(property), `${locale} entries must be property assignments`);
    const key = property.name.getText(sourceFile).replace(/^['"]|['"]$/g, "");
    assert.ok(ts.isStringLiteral(property.initializer), `${locale}.${key} must be a string literal`);
    values.set(key, property.initializer.text);
  }
  locales.set(locale, values);
}

assert.deepEqual([...locales.keys()].sort(), ["de", "pt", "ru", "zh"]);
for (const [locale, values] of locales) {
  assert.deepEqual([...values.keys()].sort(), [...keys].sort(), `${locale} must cover every host-locale key exactly once`);
  const intentionallyUniversal = new Set(["SMS", "WhatsApp"]);
  for (const key of keys) {
    const value = values.get(key);
    assert.ok(value && value.trim(), `${locale}.${key} must not be blank`);
    if (!intentionallyUniversal.has(key)) assert.notEqual(value, key, `${locale}.${key} must not fall back to English`);
  }
  for (const countdownKey of ["{count} day away", "{count} days away"]) {
    assert.ok(values.get(countdownKey).includes("{count}"), `${locale}.${countdownKey} must preserve {count}`);
  }
}

assert.match(contextSource, /import \{ HOST_LOCALE_MICRO \} from "\.\/hostLocaleMicro";/);
assert.match(contextSource, /HOST_LOCALE_MICRO\[lang as keyof typeof HOST_LOCALE_MICRO\]/);
assert.match(contextSource, /const EV: Record<string, Dict> = \{ en: EN, es: ES, co: CO, de: DE, ru: RU, zh: ZH, pt: PT \};/);

console.log(`PASS complete OneEvent host-locale dictionaries: ${keys.length} keys × ${locales.size} added languages`);
