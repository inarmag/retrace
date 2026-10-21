// Builds the static site into _site/: every page in src/ is a template, every
// string comes from locales/<lang>.json. The landing page is built once per
// language in site.json; the other pages are English only.
//
// Template syntax:
//   {{key}}           the string, HTML-escaped; keys ending in _html go in raw
//   {{include:path}}  a file under src/, HTML-escaped (the licence texts)
//   {{partial:name}}  src/_partials/name.html, rendered with the same strings
//
// node build.mjs            build
// node build.mjs --check    build, and fail on any untranslated key

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const OUT = "_site";
const site = JSON.parse(readFileSync("site.json", "utf8"));
const base = site.base_url.replace(/\/?$/, "/");
const locales = Object.fromEntries(
  site.locales.map((l) => [l.code, JSON.parse(readFileSync(`locales/${l.code}.json`, "utf8"))]),
);
const en = locales.en;
const live = Boolean(site.app_store_id && site.live);
const storeUrl = live ? `https://apps.apple.com/app/id${site.app_store_id}` : "";

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function render(template, vars, where) {
  return template.replace(/\{\{\s*([\w:./-]+)\s*\}\}/g, (_, key) => {
    if (key.startsWith("include:")) return esc(readFileSync(join("src", key.slice(8)), "utf8").trimEnd());
    if (key.startsWith("partial:")) return render(readFileSync(join("src/_partials", `${key.slice(8)}.html`), "utf8").trimEnd(), vars, where);
    if (!(key in vars)) throw new Error(`${where}: no string for {{${key}}}`);
    return key.endsWith("_html") ? vars[key] : esc(vars[key]);
  });
}

function write(path, html) {
  const file = join(OUT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

const pageUrl = (l) => base + l.path;

function hreflang() {
  const links = site.locales.map((l) => `<link rel="alternate" hreflang="${l.hreflang}" href="${pageUrl(l)}" />`);
  links.push(`<link rel="alternate" hreflang="x-default" href="${base}" />`);
  return links.join("\n    ");
}

function languageNav(current, root) {
  return site.locales
    .map((l) => {
      const here = l.code === current.code ? ' aria-current="page"' : "";
      return `<a href="${root}${l.path}" hreflang="${l.hreflang}" lang="${l.hreflang}"${here}>${esc(l.name)}</a>`;
    })
    .join("\n        ");
}

function jsonld(l, t) {
  const data = {
    "@context": "https://schema.org",
    "@type": ["VideoGame", "MobileApplication"],
    name: "RETRACE",
    alternateName: site.alternate_name,
    description: t.jsonld_description,
    url: pageUrl(l),
    image: `${base}assets/ember-512.png`,
    ...(live && { sameAs: [storeUrl], downloadUrl: storeUrl }),
    operatingSystem: "iOS",
    applicationCategory: "GameApplication",
    genre: "Arcade",
    gamePlatform: ["iPhone", "iPad"],
    inLanguage: site.game_languages,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    author: { "@type": "Organization", name: site.author },
  };
  return JSON.stringify(data, null, 2).replace(/</g, "\\u003c").replace(/\n/g, "\n    ");
}

// Strings and values every page can use.
function common(l, root) {
  return {
    lang: l.hreflang,
    dir: l.dir || "ltr",
    root,
    base_url: base,
    copyright: site.copyright,
    terms_url: site.terms_url,
    app_store_url: storeUrl,
    year: String(new Date().getFullYear()),
  };
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const p of site.static) if (existsSync(p)) cpSync(p, join(OUT, p), { recursive: true });

// The landing page, once per language.
const landing = readFileSync("src/index.html", "utf8");
const missing = [];
for (const l of site.locales) {
  const t = locales[l.code];
  for (const k of Object.keys(en)) if (!k.includes(".") && !(k in t) && !site.english_only.some((p) => k.startsWith(p))) missing.push(`${l.code}: ${k}`);
  const root = l.path ? "../" : "";
  const vars = {
    ...en,
    ...t,
    ...common(l, root),
    canonical: pageUrl(l),
    og_locale: l.og,
    // Chinese and Japanese set no space between sentences.
    subhero: [t.hook, t.claims].join(/^(ja|zh)/.test(l.hreflang) ? "" : " "),
    hreflang_html: hreflang(),
    languages_html: languageNav(l, root),
    jsonld_html: jsonld(l, { ...en, ...t }),
    banner_html: live ? `<meta name="apple-itunes-app" content="app-id=${site.app_store_id}" />` : "",
  };
  write(join(l.path, "index.html"), render(landing, vars, `${l.code}/index.html`));
}

// The English-only pages.
const enLocale = site.locales.find((l) => l.code === "en");
for (const page of site.english_pages) {
  const vars = { ...en, ...common(enLocale, "../"), canonical: `${base}${page}/` };
  write(join(page, "index.html"), render(readFileSync(`src/${page}/index.html`, "utf8"), vars, `${page}/index.html`));
}

// robots.txt and the sitemap, with every landing page's alternates.
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${base}sitemap.xml\n`);
const alternates = site.locales
  .map((l) => `<xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${pageUrl(l)}"/>`)
  .concat(`<xhtml:link rel="alternate" hreflang="x-default" href="${base}"/>`)
  .join("\n    ");
const urls = site.locales
  .map((l) => `  <url>\n    <loc>${pageUrl(l)}</loc>\n    ${alternates}\n  </url>`)
  .concat(site.english_pages.map((p) => `  <url><loc>${base}${p}/</loc></url>`));
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`,
);

if (missing.length) {
  const msg = `untranslated, English shown instead:\n  ${missing.join("\n  ")}`;
  if (process.argv.includes("--check")) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
}
console.log(`built ${site.locales.length} landing pages and ${site.english_pages.length} English pages into ${OUT}/`);
