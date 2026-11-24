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
  for (const property of ["og:title", "og:description", "og:url", "og:image", "twitter:card", "twitter:title", "twitter:description", "twitter:image", "twitter:site"]) {
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
      const founder = graph?.find((item) => item["@type"] === "Person");
      const game = graph?.find((item) => item["@type"] === "VideoGame");
      const organizationSameAs = [
        "https://www.linkedin.com/company/minnsace",
        "https://github.com/minnsace",
        "https://x.com/minnsace",
        "https://itch.io/profile/minnsace",
        "https://store.steampowered.com/app/2071710/Deadlight_Tavern/",
        "https://austinmcgaugh.com/",
        "https://www.youtube.com/@Minnsace",
        "https://www.tiktok.com/@minnsace",
        "https://bsky.app/profile/minnsace.com",
        "https://www.facebook.com/profile.php?id=61577445890097",
      ];
      const founderSameAs = [
        "https://www.linkedin.com/in/austinmcgaugh/",
        "https://x.com/AustinMcGaugh",
        "https://www.youtube.com/@AustinMcGaugh",
        "https://github.com/minnsace",
        "https://github.com/AustinMcGaugh",
        "https://www.instagram.com/austinmcgaugh/",
      ];
      check(organization?.["@id"] === "https://minnsace.com/#organization", "Organization @id must stay https://minnsace.com/#organization");
      check(organization?.name === "Minnsace Inc." && organization?.email === "hello@minnsace.com", "Organization structured data must match published contact details");
      check(organization?.founder?.["@id"] === "https://austinmcgaugh.com/#person", "Organization founder must reference https://austinmcgaugh.com/#person");
      check(JSON.stringify(organization?.sameAs) === JSON.stringify(organizationSameAs), "Organization sameAs must list the confirmed profiles");
      check(founder?.["@id"] === "https://austinmcgaugh.com/#person" && founder?.name === "Austin McGaugh" && founder?.url === "https://austinmcgaugh.com/" && founder?.jobTitle === "Founder", "Homepage founder entity must match Austin McGaugh");
      check(JSON.stringify(founder?.sameAs) === JSON.stringify(founderSameAs), "Homepage founder sameAs must list the confirmed profiles");
      check(game?.name === "Deadlight Tavern" && JSON.stringify(game?.sameAs) === JSON.stringify([
        "https://store.steampowered.com/app/2071710/Deadlight_Tavern/",
        "https://minnsace.itch.io/deadlight-tavern",
      ]), "Game structured data must match the confirmed Steam and itch listings");
      check(JSON.stringify(game?.genre) === JSON.stringify(["Action", "Indie"]), "Deadlight Tavern genre must match the Steam listing");
      check(game?.image === "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2071710/d1c176b8940c6a5c50498b097753d590faa1a96a/capsule_616x353.jpg", "Deadlight Tavern image must be the verified Steam capsule");
      check(game?.description && html.includes(game.description), "Structured game description must also be visible on the page");
      check(html.includes("Action, Indie"), "Deadlight Tavern genre must be visible on the page");
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
  check(/founded by\s+(?:<[^>]+>\s*)?Austin McGaugh/.test(html), "About page must state the confirmed founder relationship");
  check(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/minnsace\.com\/about\.html["']/i.test(html), "About page canonical URL must identify its public URL");
  const schemaBlocks = [...html.matchAll(/<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi)];
  check(schemaBlocks.length === 1, "About page must have one JSON-LD script");
  if (schemaBlocks.length === 1) {
    try {
      const schema = JSON.parse(schemaBlocks[0][1]);
      const organization = schema["@graph"]?.find((item) => item["@type"] === "Organization");
      const founder = schema["@graph"]?.find((item) => item["@type"] === "Person");
      check(organization?.["@id"] === "https://minnsace.com/#organization", "About page Organization @id must stay https://minnsace.com/#organization");
      check(organization?.founder?.["@id"] === "https://austinmcgaugh.com/#person", "About page founder must reference https://austinmcgaugh.com/#person");
      check(JSON.stringify(organization?.sameAs) === JSON.stringify([
        "https://www.linkedin.com/company/minnsace",
        "https://github.com/minnsace",
        "https://x.com/minnsace",
        "https://itch.io/profile/minnsace",
        "https://store.steampowered.com/app/2071710/Deadlight_Tavern/",
        "https://austinmcgaugh.com/",
        "https://www.youtube.com/@Minnsace",
        "https://www.tiktok.com/@minnsace",
        "https://bsky.app/profile/minnsace.com",
        "https://www.facebook.com/profile.php?id=61577445890097",
      ]), "About page Organization sameAs must list the confirmed profiles");
      check(founder?.name === "Austin McGaugh" && founder?.jobTitle === "Founder", "Founder structured data must match the visible biography");
      check(founder?.["@id"] === "https://austinmcgaugh.com/#person" && founder?.url === "https://austinmcgaugh.com/", "About page Person must use the austinmcgaugh.com entity");
      check(JSON.stringify(founder?.sameAs) === JSON.stringify([
        "https://www.linkedin.com/in/austinmcgaugh/",
        "https://x.com/AustinMcGaugh",
        "https://www.youtube.com/@AustinMcGaugh",
        "https://github.com/minnsace",
        "https://github.com/AustinMcGaugh",
        "https://www.instagram.com/austinmcgaugh/",
      ]), "About page founder sameAs must list the confirmed profiles");
    } catch (error) {
      check(false, `Invalid About page JSON-LD: ${error.message}`);
    }
  }
}
for (const [path, page] of pages) {
  for (const { attrs } of page.tags) {
    const protectedLinks = new Set([
      "https://store.steampowered.com/app/2071710/Deadlight_Tavern/",
      "https://www.linkedin.com/in/austinmcgaugh/",
      "https://www.linkedin.com/company/minnsace",
      "https://austinmcgaugh.com/",
      "https://austinmcgaugh.com/about/",
      "https://austinmcgaugh.com/projects/the-lethecary/",
    ]);
    if (protectedLinks.has(attrs.href)) {
      check(attrs.target === "_blank", `${page.file}: ${attrs.href} must open in a new tab`);
      check(attrs.rel?.split(/\s+/).includes("noopener") && attrs.rel?.split(/\s+/).includes("noreferrer"), `${page.file}: ${attrs.href} must be protected`);
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
for (const text of ["Minnsace Inc.", "mailto:hello@minnsace.com", "https://store.steampowered.com/app/2071710/Deadlight_Tavern/", "In development: The Lethecary", "https://austinmcgaugh.com/projects/the-lethecary/"]) {
  check(read("index.html").includes(text), `Missing confirmed company/game information: ${text}`);
}
const homeHtml = read("index.html");
const lethecary = homeHtml.slice(homeHtml.indexOf('id="lethecary"'), homeHtml.indexOf('id="studio"'));
check(lethecary.includes("first-person psychological horror") && lethecary.includes("Unreal Engine 5") && lethecary.includes("psychiatrist"), "The Lethecary section must describe the confirmed game");
check(!/store\.steampowered\.com|itch\.io/i.test(lethecary), "The Lethecary section must not include a store link");
for (const url of ["https://austinmcgaugh.com/", "https://austinmcgaugh.com/about/"]) {
  check(homeHtml.includes(`href="${url}"`), `Homepage must link to ${url}`);
  check(read("about.html").includes(`href="${url}"`), `About page must link to ${url}`);
}
for (const file of ["index.html", "about.html", "privacy.html"]) {
  const page = pages.get(resolve(root, file));
  const robots = page?.tags.find((tag) => tag.name === "meta" && tag.attrs.name === "robots");
  const site = page?.tags.find((tag) => tag.name === "meta" && tag.attrs.name === "twitter:site");
  check(robots?.content?.replace(/\s+/g, "") === "index,follow" || robots?.attrs.content?.replace(/\s+/g, "") === "index,follow", `${file} must use robots index,follow`);
  check(site?.attrs.content === "@minnsace", `${file} must set twitter:site to @minnsace`);
}
const missingPage = pages.get(resolve(root, "404.html"));
check(missingPage, "Missing 404.html");
if (missingPage) {
  for (const url of ["./\"", "about.html", "https://austinmcgaugh.com/"]) {
    check(missingPage.html.includes(url === "./\"" ? 'href="./"' : `href="${url}"`), `404 page must link to ${url}`);
  }
  const robots = missingPage.tags.find((tag) => tag.name === "meta" && tag.attrs.name === "robots");
  check(robots?.attrs.content?.replace(/\s+/g, "") === "noindex,follow", "404 page must be noindex");
}
for (const page of pages.values()) {
  const icon = page.tags.find((tag) => tag.name === "link" && tag.attrs.rel === "icon");
  const apple = page.tags.find((tag) => tag.name === "link" && tag.attrs.rel === "apple-touch-icon");
  check(icon?.attrs.href === "assets/favicon.png", `${page.file}: favicon must be the resized icon`);
  check(apple?.attrs.href === "assets/apple-touch-icon.png", `${page.file}: apple touch icon must be the resized icon`);
}
const pngSize = (file) => {
  const bytes = readFileSync(join(root, file));
  check(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${file} must be a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.length };
};
const favicon = pngSize("assets/favicon.png");
const appleIcon = pngSize("assets/apple-touch-icon.png");
check(favicon.width === 32 && favicon.height === 32 && favicon.bytes < 20000, "favicon.png must be a 32px icon under 20KB");
check(appleIcon.width === 180 && appleIcon.height === 180 && appleIcon.bytes < 80000, "apple-touch-icon.png must be a 180px icon under 80KB");
check(read(".github/workflows/pages.yml").includes("404.html"), "Pages workflow must publish 404.html");
check(!/\bVR.only\b|virtual reality|tracked controllers|compatible VR headset/i.test(read("index.html")), "Outdated VR claims must not return");
const sitemap = read("sitemap.xml");
for (const url of ["https://minnsace.com/", "https://minnsace.com/about.html", "https://minnsace.com/privacy.html"]) {
  check(new RegExp(`<loc>${url.replaceAll(".", "\\.")}</loc>\\s*<lastmod>\\d{4}-\\d{2}-\\d{2}</lastmod>`).test(sitemap), `Sitemap missing lastmod for ${url}`);
}
check(!sitemap.includes("404"), "Sitemap must not list the 404 page");
check(read("robots.txt").includes("Sitemap: https://minnsace.com/sitemap.xml"), "robots.txt must reference the sitemap");
assert.equal(errors.length, 0, `Site checks failed:\n${errors.join("\n")}`);
console.log(`PASS: ${pages.size} pages; local links, anchors, SEO metadata, visible JSON-LD, founder profiles, image alt attributes, PNG assets, sitemap, and confirmed company/game information.`);
