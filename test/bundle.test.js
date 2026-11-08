// The classic-script bundle (npm run build): it sets one global holding the whole API, and the
// script-tag example carries the same FAQ as examples/faq.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { build, GLOBAL_NAME } from '../scripts/build.mjs';
import * as entry from '../src/index.js';
import * as reader from '../src/reader.js';

test('the bundle sets window.BindpressManual with everything the two entries export', async () => {
  const outdir = await mkdtemp(join(tmpdir(), 'bindpress-manual-'));
  try {
    await build(outdir);
    for (const file of ['bindpress-manual.js', 'bindpress-manual.min.js']) {
      const code = await readFile(join(outdir, file), 'utf8');
      assert.match(code, /^\/\*! @bindpress\/manual \d+\.\d+\.\d+ \| MIT License/, `${file} starts with the licence banner`);
      assert.doesNotMatch(code, /^\s*(import|export)\s/m, `${file} is a classic script`);
      const context = vm.createContext({});
      vm.runInContext(code, context);
      const api = context[GLOBAL_NAME];
      assert.deepEqual(Object.keys(api).sort(), [...new Set([...Object.keys(entry), ...Object.keys(reader)])].sort(), file);
      assert.match(api.renderManual({ kind: 'faq', title: '<b>Help</b>', pages: [] }), /<h1 class="x-man-faq-title">&lt;b&gt;Help&lt;\/b&gt;<\/h1>/, file);
    }
    assert.match(await readFile(join(outdir, 'manual.css'), 'utf8'), /\.x-man-faq/);
  } finally {
    await rm(outdir, { recursive: true, force: true });
  }
});

test('the script-tag example holds the same FAQ as examples/faq.json', async () => {
  const html = await readFile(new URL('../examples/browser.html', import.meta.url), 'utf8');
  const block = /<script type="application\/json" id="faq-data">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(block, 'the example has its data block');
  const faq = JSON.parse(await readFile(new URL('../examples/faq.json', import.meta.url), 'utf8'));
  assert.deepEqual(JSON.parse(block[1]), faq);
});
