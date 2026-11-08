// validateManual(): what it accepts, and that each mistake is reported where it is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateManual } from '../src/validate.js';
import { sampleManual, sampleFaq } from '../src/model.js';

const example = async (name) => JSON.parse(await readFile(new URL(`../examples/${name}.json`, import.meta.url), 'utf8'));
/** The errors as "path: message" lines, which read well when a test fails. */
const problems = (manual) => validateManual(manual).errors.map(error => `${error.path}: ${error.message}`);
const page = (fields) => ({ id: 'p', title: 'P', level: 0, blocks: [], ...fields });

test('the examples and samples are valid', async () => {
  for (const manual of [await example('manual'), await example('faq'), sampleManual(), sampleFaq()]) {
    assert.deepEqual(validateManual(manual), { valid: true, errors: [] });
  }
});

test('the least a manual needs: a title and a list of pages', () => {
  assert.deepEqual(problems({ title: '', pages: [] }), []);
  assert.deepEqual(problems({}), ['title: is required', 'pages: is required, and must be a list of pages']);
  assert.deepEqual(problems([]), [': a manual must be a JSON object']);
});

test('fields the format does not know are allowed', () => {
  assert.deepEqual(problems({ title: 'T', pages: [page({ author: 'me' })], publishedBy: 'cms' }), []);
});

test('each top-level mistake is named', () => {
  assert.deepEqual(problems({ title: 1, kind: 'book', theme: 'dark', numbering: true, updated: '2026-02-30', version: 2, pages: [] }), [
    'kind: must be one of "manual", "faq"',
    'title: must be a string',
    'version: must be a string',
    'updated: must be a date written YYYY-MM-DD, or ""',
    'theme: must be one of "classic", "modern", "friendly"',
    'numbering: must be one of "on", "off"'
  ]);
});

test('page mistakes: ids, titles, levels and blocks', () => {
  assert.deepEqual(problems({ title: 'T', pages: [
    page({ id: 'a', level: 1 }),
    page({ id: 'a' }),
    page({ id: 'has space', level: 3 }),
    page({ id: 'd', level: 6 }),
    { id: 'e', level: 0 },
    'not a page'
  ] }), [
    'pages[0].level: the first page must be a chapter (level 0)',
    'pages[1].id: "a" is used by an earlier page; ids must be unique',
    'pages[2].id: is required: 1 to 40 letters, digits, "-" or "_"',
    'pages[2].level: is 3, but a page can sit at most one level below the page before it (0)',
    'pages[3].level: is required: a whole number from 0 to 5',
    'pages[4].title: is required',
    'pages[4].blocks: is required, and must be a list (it may be empty)',
    'pages[5]: must be an object'
  ]);
});

test('block mistakes are reported by type', () => {
  assert.deepEqual(problems({ title: 'T', pages: [page({ blocks: [
    { type: 'video' },
    { type: 'paragraph', text: 3 },
    { type: 'list', style: 'stars' },
    { type: 'note', tone: 'loud' },
    { type: 'question', text: 'An answer with no question' },
    { type: 'question', question: 'Q', id: 'same' },
    { type: 'question', question: 'Q', id: 'same' },
    { type: 'picture', fileUrl: 5, size: 'huge', align: 'top' },
    null
  ] })] }), [
    'pages[0].blocks[0].type: must be one of "paragraph", "heading", "list", "note", "table", "picture", "question"',
    'pages[0].blocks[1].text: must be a string',
    'pages[0].blocks[2].style: must be one of "bullets", "numbered"',
    'pages[0].blocks[3].tone: must be one of "info", "warning"',
    'pages[0].blocks[4].question: is required for a question',
    'pages[0].blocks[6].id: "same" is used by an earlier question on this page',
    'pages[0].blocks[7].fileUrl: must be a string',
    'pages[0].blocks[7].size: must be one of "full", "medium", "small"',
    'pages[0].blocks[7].align: must be one of "center", "left", "right"',
    'pages[0].blocks[8]: must be an object'
  ]);
});
