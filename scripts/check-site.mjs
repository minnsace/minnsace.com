import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const pages = new Map();
const read = (file) => readFileSync(join(root, file), "utf8");
const check = (condition, message) => { if (!condition) errors.push(message); };
const attributes = (tag) => Object.fromEntries(
  [...tag.matchAll(/([a-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
    .map((match) => [match[1].toLowerCase(), match[2] ?? match[3]]),
);

for (const file of readdirSync(root).filter((file) => file.endsWith(".html"))) {
  const html = read(file);
  const tags = [...html.matchAll(/<([a-z][\w-]*)\b[^>]*>/gi)]
    .map(([text, name]) => ({ name: name.toLowerCase(), attrs: attributes(text) }));
  const ids = tags.filter(({ attrs }) => attrs.id).map(({ attrs }) => attrs.id);
  check(new Set(ids).size === ids.length, `${file}: duplicate IDs`);
  check(tags.filter(({ name }) => name === "h1").length === 1, `${file}: expected one h1`);
  check(tags.some(({ name, attrs }) => name === "html" && attrs.lang === "en"), `${file}: missing language`);
  check(/<title>[^<]+<\/title>/.test(html), `${file}: missing title`);
  for (const name of ["viewport", "description"]) {
    check(tags.some((tag) => tag.name === "meta" && tag.attrs.name === name && tag.attrs.content), `${file}: missing ${name}`);
  }
  for (const tag of tags.filter(({ name }) => name === "img")) {
    check(Object.hasOwn(tag.attrs, "alt"), `${file}: image lacks alt attribute`);
  }
  pages.set(resolve(root, file), { ids: new Set(ids), tags, file });
}
check(pages.size >= 2, "Expected homepage and privacy page");
for (const [path, page] of pages) {
  for (const { attrs } of page.tags) {
    for (const ref of [attrs.href, attrs.src].filter((value) => value !== undefined)) {
      if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(ref)) continue;
      const url = new URL(ref, "https://local.invalid/");
      const localPath = decodeURIComponent(ref.split(/[?#]/)[0]);
      let target = localPath ? resolve(dirname(path), localPath) : path;
      if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
      check(existsSync(target), `${page.file}: missing local target ${ref}`);
      if (url.hash && pages.has(target)) {
        check(pages.get(target).ids.has(decodeURIComponent(url.hash.slice(1))), `${page.file}: missing anchor ${ref}`);
      }
    }
  }
}
check(read("CNAME").trim() === "minnsace.com", "CNAME must be minnsace.com");
for (const file of [".nojekyll", "robots.txt", ".github/workflows/pages.yml", "styles.css", "sitemap.xml"]) {
  check(existsSync(join(root, file)), `Missing deployment input: ${file}`);
}
for (const file of ["minnsace-banner.png", "minnsace-logo.png", "minnsace-icon.png"]) {
  const path = join(root, "assets", file);
  check(existsSync(path) && readFileSync(path).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `Missing or invalid PNG: ${file}`);
}
for (const [, ref] of read("styles.css").matchAll(/url\(['"]?([^)'"\s]+)/g)) {
  if (!/^(?:[a-z][\w+.-]*:|\/\/)/i.test(ref)) check(existsSync(join(root, ref)), `Missing CSS asset: ${ref}`);
}
for (const text of ["Minnsace Inc.", "mailto:hello@minnsace.com", "https://store.steampowered.com/app/2071710/"]) {
  check(read("index.html").includes(text), `Missing confirmed company/game information: ${text}`);
}
check(!/\bVR.only\b|virtual reality|tracked controllers|compatible VR headset/i.test(read("index.html")), "Outdated VR claims must not return");
check(read("sitemap.xml").includes("<loc>https://minnsace.com/</loc>"), "Missing homepage sitemap entry");
assert.equal(errors.length, 0, `Site checks failed:\n${errors.join("\n")}`);
console.log(`PASS: ${pages.size} pages; local links, anchors, metadata, image alt attributes, PNG assets, deployment inputs, and confirmed company/game information.`);
