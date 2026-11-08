# @bindpress/manual

Render a user manual or FAQ, written as one JSON document, to safe, accessible HTML.

- **Manuals** read like a PDF: a cover with contents, one sheet per chapter or section, a folding contents tree, search, page numbers, zoom, full screen and print.
- **FAQs** work like a help centre: topics on the left, questions that open and close, search that filters as you type, and a link to every answer.

There are no dependencies and no build step, the reader runs under a strict Content Security Policy, and the HTML works without JavaScript.

**[Documentation](https://chooyee.github.io/bindpress-manual/docs/)** · **[JSON format](https://chooyee.github.io/bindpress-manual/docs/format.html)** · **[Live demo](https://chooyee.github.io/bindpress-manual/docs/demo.html)**

## Install

```sh
npm install @bindpress/manual
```

## Use

On the server (or in a build step):

```js
import { renderManual, validateManual } from '@bindpress/manual';

const { valid, errors } = validateManual(json); // optional: report mistakes in the data
const html = renderManual(json, { id: 'guide' }); // safe to put on a page as it is
```

In the page:

```html
<link rel="stylesheet" href="/node_modules/@bindpress/manual/src/manual.css">
<script type="module">
  import { startManualReaders } from '/node_modules/@bindpress/manual/src/reader.js';
  startManualReaders();
</script>
```

With a bundler, import `@bindpress/manual/reader` and `@bindpress/manual/manual.css` instead.

With a plain script tag, with no modules (this also works from a page opened from disk):

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@bindpress/manual@0.1/dist/manual.css">
<script src="https://cdn.jsdelivr.net/npm/@bindpress/manual@0.1/dist/bindpress-manual.min.js"></script>
<script>
  document.getElementById('manual').innerHTML = BindpressManual.renderManual(json);
  BindpressManual.startManualReaders();
</script>
```

## The JSON

```json
{
  "kind": "faq",
  "title": "Help centre",
  "theme": "modern",
  "numbering": "off",
  "pages": [
    {
      "id": "account",
      "title": "Your account",
      "level": 0,
      "blocks": [
        { "type": "question", "id": "forgot-password", "question": "I forgot my password. What now?", "text": "Choose Forgot password on the sign-in page." }
      ]
    }
  ]
}
```

Pages are a flat list in reading order. `level` gives the nesting (0 is a chapter or topic, 1 a section, and so on). The block types are `paragraph`, `heading`, `list`, `note`, `table`, `picture` and `question`. All text is plain text. The [format reference](https://chooyee.github.io/bindpress-manual/docs/format.html) covers every field. There is also a [JSON Schema](schema/manual.schema.json), shipped as `@bindpress/manual/schema.json`.

## What's in the package

| Import | What |
|---|---|
| `@bindpress/manual` | `renderManual`, `validateManual`, `faqJsonLd`, the data model (`normalizeManual`, `outline`, tree moves for editors), `esc`, `safeUrl` |
| `@bindpress/manual/reader` | `startManualReaders`, `stopManualReaders` (browser) |
| `@bindpress/manual/manual.css` | Styles for both views and the three themes (classic, modern, friendly) |
| `@bindpress/manual/schema.json` | JSON Schema for the input |
| `dist/bindpress-manual.min.js`, `dist/manual.css` | Everything in one classic script (`window.BindpressManual`), for a plain `<script src>` |

TypeScript types are included.

## Develop

```sh
npm install
npm test              # unit tests (node:test)
npm run typecheck     # TypeScript reads the JSDoc
npm run build         # dist/: the script-tag bundle
npm run docs          # docs and examples at http://localhost:8000/docs/
npx playwright install chromium && npm run test:browser   # the reader in a real browser
```

See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security problem, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
