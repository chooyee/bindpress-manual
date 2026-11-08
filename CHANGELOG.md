# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Before 1.0, minor versions may contain breaking changes; they are listed under **Changed**.

## [Unreleased]

### Added
- `dist/bindpress-manual.min.js` (and `.js`, `manual.css`): a classic-script bundle that sets `window.BindpressManual`, for pages that load the package with a plain `<script src>`. It works from a page opened from disk, where browsers refuse ES modules. Built by `npm run build`, and run before every publish.
- `examples/browser.html` uses the bundle with the JSON in the page. The ES-module example is now `examples/browser-module.html`.

## [0.1.0] - 2026-11-08

First release, taken out of the BindPress CMS's Manual block so other projects can use it.

### Added
- `renderManual(manual, { id, view, edit })`: the paged view for manuals and a new help-centre view for FAQs. `view` overrides which one is used.
- FAQ view: a topic list, questions that open and close, and a link to every answer (`#<id>-<topic>-<question>`). Questions can carry an optional stable `id`.
- `validateManual()`: reports mistakes in the data with their path, including the rules a JSON Schema can't express.
- `faqJsonLd()`: schema.org FAQPage data for search engines.
- `schema/manual.schema.json`: a JSON Schema (draft 2020-12) for the format.
- Reader: `startManualReaders()` for both views, and `stopManualReaders()` for pages that replace their HTML.
- FAQ reader: search that filters as you type, Expand all / Collapse all, the current topic marked, and opening the answer an address points to.
- `manual.css` without any host scoping. The narrow layout follows the manual's own width (a container query), and the colours of the contents tree are custom properties (`--man-nav-*`).
- TypeScript types, generated from JSDoc.
- HTML documentation with a live demo, examples and a browser smoke test.

### Fixed (compared with the CMS block)
- A picture address containing `"` could end the `src` attribute and add attributes to the image. The address is now escaped as well as checked.
