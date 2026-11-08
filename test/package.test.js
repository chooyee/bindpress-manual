// The parts that must agree with each other: the JSON Schema and the code, the package's
// entry points and the files they name, and the JSON-LD helper's escaping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import * as model from '../src/model.js';
import { faqJsonLd } from '../src/structured-data.js';
import * as entry from '../src/index.js';

const root = new URL('../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('the JSON Schema lists the same values as the code', async () => {
  const schema = await json('schema/manual.schema.json');
  const block = schema.$defs.block;
  const branch = (type) => block.allOf.find(rule => rule.if.properties.type.const === type).then.properties;
  assert.deepEqual(schema.properties.kind.enum, model.KINDS);
  assert.deepEqual(schema.properties.theme.enum, model.THEMES);
  assert.deepEqual(block.properties.type.enum, model.BLOCK_TYPES);
  assert.deepEqual(branch('list').style.enum, model.LIST_STYLES);
  assert.deepEqual(branch('note').tone.enum, model.NOTE_TONES);
  assert.deepEqual(branch('picture').size.enum, model.PICTURE_SIZES);
  assert.deepEqual(branch('picture').align.enum, model.PICTURE_ALIGNS);
  assert.equal(schema.$defs.page.properties.level.maximum, model.MAX_LEVEL);
  assert.equal(schema.$defs.id.pattern, model.ID_PATTERN.source);
  assert.deepEqual(schema.required, ['title', 'pages']);
});

test('every entry point in package.json exists', async () => {
  const pkg = await json('package.json');
  for (const [name, target] of Object.entries(pkg.exports)) {
    for (const path of typeof target === 'string' ? [target] : [target.default]) {
      await assert.doesNotReject(access(new URL(path, root)), `${name} → ${path}`);
    }
  }
});

test('the main entry exports what the docs describe', () => {
  for (const name of ['renderManual', 'renderBlock', 'validateManual', 'faqJsonLd', 'normalizeManual', 'outline', 'esc', 'safeUrl', 'sampleManual', 'sampleFaq']) {
    assert.equal(typeof entry[name], 'function', name);
  }
});

test('every source file says what it is for', async () => {
  for (const name of await readdir(new URL('src/', root))) {
    const text = await readFile(new URL(`src/${name}`, root), 'utf8');
    assert.match(text, /^(\/\*|\/\/)/, `${name} starts with a comment`);
  }
});

test('faqJsonLd: the questions as schema.org data that cannot close its script element', () => {
  const ld = faqJsonLd({ kind: 'faq', pages: [{ id: 't', title: 'T', level: 0, blocks: [
    { type: 'question', question: 'Is </script><script>alert(1)</script> safe?', text: 'Yes & always.' },
    { type: 'question', question: 'No answer', text: '' }
  ] }] });
  assert.doesNotMatch(ld, /[<>&]/);
  const data = JSON.parse(ld);
  assert.equal(data['@type'], 'FAQPage');
  assert.equal(data.mainEntity.length, 1, 'a question without an answer is left out');
  assert.equal(data.mainEntity[0].name, 'Is </script><script>alert(1)</script> safe?');
  assert.equal(data.mainEntity[0].acceptedAnswer.text, 'Yes & always.');
  assert.equal(faqJsonLd({ pages: [] }), '');
});
