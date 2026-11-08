// The data model: cleaning input, numbering, and the tree moves an editor uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeManual, normalizeBlock, outline, buildTree, allowedMoves, movePage, addPage, removePage,
  parseTableRows, parseListItems, formatDate, sampleManual, sampleFaq
} from '../src/model.js';

const pages = (...levels) => levels.map((level, index) => ({ id: `p${index}`, title: `Page ${index}`, level, blocks: [] }));

test('anything at all comes out as a complete manual', () => {
  for (const input of [undefined, null, 'text', 42, [], {}]) {
    assert.deepEqual(normalizeManual(input), {
      kind: 'manual', title: '', subtitle: '', version: '', updated: '', theme: 'classic', numbering: 'on', pages: []
    });
  }
});

test('unknown values fall back to the defaults', () => {
  const manual = normalizeManual({ kind: 'book', theme: 'dark', numbering: 'yes', updated: '5 Nov 2026', title: 7, pages: [null, 'x', { level: 'two' }] });
  assert.equal(manual.kind, 'manual');
  assert.equal(manual.theme, 'classic');
  assert.equal(manual.numbering, 'on');
  assert.equal(manual.updated, '');
  assert.equal(manual.title, '');
  assert.equal(manual.pages.length, 1, 'only objects become pages');
  assert.equal(manual.pages[0].level, 0);
  assert.match(manual.pages[0].id, /^[a-z0-9]+$/, 'a page without an id gets one');
});

test('levels are kept in order: the first page is a chapter, and no page skips a level', () => {
  const manual = normalizeManual({ pages: pages(2, 3, 1, 9, 0, -4) });
  assert.deepEqual(manual.pages.map(page => page.level), [0, 1, 1, 2, 0, 0]);
});

test('repeated or unusable page ids are replaced, so every address is unique', () => {
  const manual = normalizeManual({ pages: [{ id: 'same' }, { id: 'same' }, { id: 'has space' }, { id: '<script>' }] });
  const ids = manual.pages.map(page => page.id);
  assert.equal(ids[0], 'same');
  assert.equal(new Set(ids).size, 4);
  for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]+$/);
});

test('a block keeps only the fields of its type', () => {
  assert.deepEqual(normalizeBlock({ type: 'list', text: 'a', tone: 'warning' }), { type: 'list', text: 'a', style: 'bullets' });
  assert.deepEqual(normalizeBlock({ type: 'note', text: 'a', tone: 'loud' }), { type: 'note', text: 'a', tone: 'info' });
  assert.deepEqual(normalizeBlock({ type: 'video', text: 'a' }), { type: 'paragraph', text: 'a' }, 'an unknown type becomes a paragraph');
  assert.deepEqual(normalizeBlock({ type: 'question', question: 'Q?', text: 'A', id: 'q-1' }), { type: 'question', text: 'A', question: 'Q?', id: 'q-1' });
  assert.equal(normalizeBlock({ type: 'question', id: 'not valid!' }).id, undefined, 'an unusable question id is dropped');
  assert.deepEqual(normalizeBlock({ type: 'picture', fileUrl: 'a.png', size: 'huge' }),
    { type: 'picture', text: '', fileId: '', alt: '', caption: '', size: 'full', align: 'center', fileUrl: 'a.png' });
});

test('outline numbers pages, finds their chapter, and counts figures per chapter', () => {
  const picture = { type: 'picture', fileUrl: 'a.png' };
  const manual = normalizeManual({ pages: [
    { id: 'a', level: 0, blocks: [picture] }, { id: 'b', level: 1, blocks: [picture, picture] }, { id: 'c', level: 2, blocks: [] },
    { id: 'd', level: 1, blocks: [picture] }, { id: 'e', level: 0, blocks: [picture] }
  ] });
  const entries = outline(manual);
  assert.deepEqual(entries.map(entry => entry.number), ['1', '1.1', '1.1.1', '1.2', '2']);
  assert.deepEqual(entries.map(entry => entry.pageNumber), [2, 3, 4, 5, 6], 'the cover is page 1');
  assert.deepEqual(entries.map(entry => entry.chapter.id), ['a', 'a', 'a', 'a', 'e']);
  assert.deepEqual(entries.map(entry => entry.figureStart), [0, 1, 3, 3, 0], 'figures restart in each chapter');
  const unnumbered = outline({ ...manual, numbering: 'off' });
  assert.deepEqual(unnumbered.map(entry => entry.figureStart), [0, 1, 3, 3, 4], 'without numbering, figures run through the manual');
});

test('buildTree nests the flat list', () => {
  const tree = buildTree(pages(0, 1, 2, 1, 0));
  assert.equal(tree.length, 2);
  assert.equal(tree[0].children.length, 2);
  assert.equal(tree[0].children[0].children[0].entry.id, 'p2');
  assert.equal(tree[1].entry.id, 'p4');
});

test('moves carry a page with its sub-pages', () => {
  const list = pages(0, 1, 0, 1, 1);
  assert.deepEqual(allowedMoves(list, 0), { up: false, down: true, in: false, out: false });
  assert.deepEqual(movePage(list, 2, 'up').map(page => page.id), ['p2', 'p3', 'p4', 'p0', 'p1']);
  assert.deepEqual(movePage(list, 0, 'down').map(page => page.id), ['p2', 'p3', 'p4', 'p0', 'p1']);
  assert.deepEqual(movePage(list, 2, 'in').map(page => page.level), [0, 1, 1, 2, 2]);
  assert.deepEqual(movePage(list, 3, 'out').map(page => [page.id, page.level]), [['p0', 0], ['p1', 1], ['p2', 0], ['p4', 1], ['p3', 0]]);
  assert.throws(() => movePage(list, 0, 'up'), /cannot move up/);
  assert.equal(list[2].level, 0, 'the original list is not changed');
});

test('adding and removing pages', () => {
  const list = pages(0, 1, 0);
  const added = addPage(list, 0, true);
  assert.equal(added.index, 2);
  assert.equal(added.pages[2].level, 1);
  assert.equal(addPage(list, null).pages.at(-1).level, 0);
  assert.deepEqual(removePage(list, 0).map(page => page.id), ['p2']);
});

test('lists, tables and dates are parsed as authors type them', () => {
  assert.deepEqual(parseListItems(' one \n\n two\n'), ['one', 'two']);
  assert.deepEqual(parseTableRows('A | B\n\n1 |2 '), [['A', 'B'], ['1', '2']]);
  assert.equal(formatDate('2026-11-05'), '5 November 2026');
  assert.equal(formatDate('2026-13-45'), '');
  assert.equal(formatDate(''), '');
});

test('the samples are already clean', () => {
  for (const sample of [sampleManual(), sampleFaq()]) assert.deepEqual(normalizeManual(sample), sample);
});
