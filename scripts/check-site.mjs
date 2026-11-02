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
  pages.set(resolve(root, file), { ids: new Set(ids), tags, file, html });
}
check(pages.size >= 3, "Expected homepage, About page, and privacy page");
const homepage = pages.get(resolve(root, "index.html"));
if (homepage) {
  const { html } = homepage;
  for (const property of ["og:title", "og:description", "og:url", "og:image", "twitter:card", "twitter:title", "twitter:description", "twitter:image"]) {
    check(new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${property}["']`, "i").test(html), `Homepage missing ${property}`);
  }
  check(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/minnsace\.com\/["']/i.test(html), "Homepage canonical URL must identify minnsace.com");
  const schemaBlocks = [...html.matchAll(/<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi)];
  check(schemaBlocks.length === 1, "Homepage must have one JSON-LD script");
  if (schemaBlocks.length === 1) {
    try {
      const schema = JSON.parse(schemaBlocks[0][1]);
      const graph = schema["@graph"];
      check(schema["@context"] === "https://schema.org" && Array.isArray(graph), "Invalid JSON-LD graph");
      const organization = graph?.find((item) => item["@type"] === "Organization");
      const game = graph?.find((item) => item["@type"] === "VideoGame");
      check(organization?.name === "Minnsace Inc." && organization?.email === "hello@minnsace.com", "Organization structured data must match published contact details");
      check(game?.name === "Deadlight Tavern" && game?.sameAs === "https://store.steampowered.com/app/2071710/", "Game structured data must match confirmed game listing");
      check(game?.description && html.includes(game.description), "Structured game description must also be visible on the page");
    } catch (error) {
      check(false, `Invalid homepage JSON-LD: ${error.message}`);
    }
  }
}
const aboutPage = pages.get(resolve(root, "about.html"));
if (aboutPage) {
  const { html } = aboutPage;
  for (const profile of [
    "https://www.linkedin.com/in/austinmcgaugh/",
    "https://www.linkedin.com/company/minnsace",
  ]) {
    check(html.includes(profile), `About page must link to ${profile}`);
  }
  check(html.includes("founded by Austin McGaugh"), "About page must state the confirmed founder relationship");
  check(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/minnsace\.com\/about\.html["']/i.test(html), "About page canonical URL must identify its public URL");
  const schemaBlocks = [...html.matchAll(/<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi)];
  check(schemaBlocks.length === 1, "About page must have one JSON-LD script");
  if (schemaBlocks.length === 1) {
    try {
      const schema = JSON.parse(schemaBlocks[0][1]);
      const founder = schema["@graph"]?.find((item) => item["@type"] === "Person");
      check(founder?.name === "Austin McGaugh" && founder?.jobTitle === "Founder", "Founder structured data must match the visible biography");
      check(founder?.url === "https://www.linkedin.com/in/austinmcgaugh/", "Founder structured data must link to the confirmed LinkedIn profile");
    } catch (error) {
      check(false, `Invalid About page JSON-LD: ${error.message}`);
    }
  }
}
for (const [path, page] of pages) {
  for (const { attrs } of page.tags) {
    if (attrs.href === "https://store.steampowered.com/app/2071710/") {
      check(attrs.target === "_blank", `${page.file}: Steam links must open in a new tab`);
      check(attrs.rel?.split(/\s+/).includes("noopener") && attrs.rel?.split(/\s+/).includes("noreferrer"), `${page.file}: external Steam links must be protected`);
    }
    if (attrs.href === "https://www.linkedin.com/in/austinmcgaugh/" || attrs.href === "https://www.linkedin.com/company/minnsace") {
      check(attrs.target === "_blank", `${page.file}: LinkedIn links must open in a new tab`);
      check(attrs.rel?.split(/\s+/).includes("noopener") && attrs.rel?.split(/\s+/).includes("noreferrer"), `${page.file}: external LinkedIn links must be protected`);
    }
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
for (const url of ["https://minnsace.com/", "https://minnsace.com/about.html", "https://minnsace.com/privacy.html"]) {
  check(read("sitemap.xml").includes(`<loc>${url}</loc>`), `Missing sitemap entry: ${url}`);
}
check(read("robots.txt").includes("Sitemap: https://minnsace.com/sitemap.xml"), "robots.txt must reference the sitemap");
assert.equal(errors.length, 0, `Site checks failed:\n${errors.join("\n")}`);
console.log(`PASS: ${pages.size} pages; local links, anchors, SEO metadata, visible JSON-LD, founder profiles, image alt attributes, PNG assets, sitemap, and confirmed company/game information.`);
