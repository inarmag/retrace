# RETRACE

Website for RETRACE, a one-hand arcade game for iPhone

https://www.retracegame.fun/

- `/` landing, and the same page in 13 more languages (`/fr/`, `/ja/`, `/ar/` …)
- `/support/` support and FAQ
- `/privacy/` privacy policy
- `/licenses/` open source licences

## Build

No text lives in the pages. `src/` holds the templates, `locales/<lang>.json` every
string, `site.json` the address, the App Store id and the languages.

```bash
node build.mjs           # → _site/
node build.mjs --check   # also fails on any key a language is missing
python3 -m http.server -d _site
```

- A new string: add the key to `locales/en.json` and every other landing language, use
  it as `{{key}}` in the template. Keys ending in `_html` are inserted unescaped.
- A new language: `locales/<code>.json` with every landing key, plus its entry in
  `site.json` (`path`, `hreflang`, native `name`, `og` locale, `dir: "rtl"` if needed).
- Support, privacy and licences are English only; their keys start with `support_`,
  `privacy_`, `licenses_`.
- `game_languages` in `site.json` lists the languages the game itself speaks (the
  structured data's `inLanguage`); update it when the game gains one.
- `live: true` in `site.json` turns on the App Store link, the Smart App Banner and the
  store link in the structured data.
- The custom domain is one line: `base_url` in `site.json`.

Deployed by `.github/workflows/pages.yml` on every push to `main`.
