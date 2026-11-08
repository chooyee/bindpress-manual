/**
 * Server rendering, the way a website would do it: read the JSON, check it, render it, and send
 * a page that links the stylesheet and the reader. Writes examples/output/manual.html and
 * examples/output/faq.html.
 *
 *   node examples/server-render.mjs
 *   npm run docs        # then open http://localhost:8000/examples/output/faq.html
 *
 * The pages carry a strict Content Security Policy (no inline script or style) to show that the
 * HTML and the reader need nothing more.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { renderManual, validateManual, faqJsonLd, esc } from '../src/index.js';

const here = new URL('.', import.meta.url);

for (const name of ['manual', 'faq']) {
  const manual = JSON.parse(await readFile(new URL(`${name}.json`, here), 'utf8'));

  const { valid, errors } = validateManual(manual);
  if (!valid) {
    console.error(`${name}.json is not valid:`);
    for (const error of errors) console.error(`  ${error.path || '(the manual)'}: ${error.message}`);
    process.exitCode = 1;
    continue;
  }

  const body = renderManual(manual, { id: name });
  // Search engines read this; it is data, so the policy below does not have to allow it.
  const jsonLd = manual.kind === 'faq' ? faqJsonLd(manual) : '';
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:">
<title>${esc(manual.title)}</title>
<link rel="stylesheet" href="../../src/manual.css">
<link rel="stylesheet" href="../page.css">
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
<script type="module" src="../start-reader.js"></script>
</head>
<body>
<main>${body}</main>
</body>
</html>
`;
  await mkdir(new URL('output/', here), { recursive: true });
  await writeFile(new URL(`output/${name}.html`, here), page);
  console.log(`Wrote examples/output/${name}.html`);
}
