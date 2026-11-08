# Contributing to @bindpress/manual

Thanks for helping. Bug reports, documentation fixes and improvements are all welcome.

## Before you start

- **Bugs**: search the [issues](https://github.com/chooyee/bindpress-manual/issues) first. If it is new, open one with the smallest manual JSON that shows the problem, what you expected, what happened, and your browser.
- **Features**: open an issue to discuss the idea before writing a large change, so we can agree on the approach. Changes to the JSON format need special care: data written today must keep rendering.
- **Security problems**: do not open a public issue. See [SECURITY.md](SECURITY.md).

## Setting up

You need Node.js 20 or later for development. (The package itself runs on Node 18 or later and in any modern browser.)

```sh
git clone https://github.com/chooyee/bindpress-manual.git
cd bindpress-manual
npm install
npm test                                 # unit tests
npm run typecheck                        # TypeScript reads the JSDoc
npm run build                            # dist/: the script-tag bundle (esbuild)
npm run docs                             # http://localhost:8000/docs/ and /examples/
npx playwright install chromium          # once
npm run test:browser                     # the reader in a real browser
```

## How the code is laid out

| File | Job |
|---|---|
| `src/model.js` | The data shape, `normalizeManual()`, numbering (`outline`) and the tree moves an editor uses. No DOM. |
| `src/validate.js` | `validateManual()`. Keep it in step with `schema/manual.schema.json` (a test checks the lists of values). |
| `src/render.js` | `renderManual()`: cleans the input and picks the view. |
| `src/render-paged.js`, `src/render-faq.js` | The two views. |
| `src/blocks.js` | One content block → HTML, shared by both views. |
| `src/escape.js` | `esc()` and `safeUrl()`. |
| `src/reader.js` | The browser entry: starts and stops readers. |
| `src/paged-reader.js`, `src/faq-reader.js`, `src/reader-search.js` | The readers. |
| `src/manual.css` | Styles for everything. |
| `scripts/build.mjs` | Builds `dist/`: the same source as one classic script. `src/` itself never needs a build. |

## Making a change

1. Create a branch from `main`, and keep the change focused: one fix or feature per pull request.
2. Follow the project rules:
   - Rendering code (`model`, `validate`, `render*`, `blocks`, `escape`) must not touch the DOM; it runs on servers.
   - Escape every value with `esc()`. Check picture addresses with `safeUrl()`, then escape them too. Build ids only from values that match `[A-Za-z0-9_-]`.
   - Reader code builds elements with `textContent` and DOM methods, never `innerHTML`. It needs no inline script or style, so it keeps working under a strict CSP. Window and document listeners take the reader's `signal`, so `stopManualReaders()` can remove them.
   - The HTML must stay useful without the reader.
   - The JSON format only grows: add fields with defaults, and never rename or remove one. Update `normalizeManual`, `validateManual`, the schema, `docs/format.html` and the types together.
   - CSS lives under `.x-man`, with colours and fonts as `--man-*` custom properties.
   - Match the code style: 2-space indent, single quotes, semicolons, plain names, and short comments that explain *why*. Every file starts with a comment saying what it is for, and every exported function has JSDoc.
3. Add or update tests in `test/`. Rendering changes need a test with hostile input. Reader changes need a check in `scripts/browser-check.mjs`.
4. Try the change in the demo, on a wide and a narrow screen.
5. Update the docs in `docs/` if you changed the format or the API.
6. Add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).

## Releasing (maintainers)

1. Move the **Unreleased** notes under a new version heading in `CHANGELOG.md`, and set `version` in `package.json`.
2. `npm test && npm run typecheck && npm run test:browser`
3. Commit, tag `vX.Y.Z` and push. The release workflow publishes to npm.
