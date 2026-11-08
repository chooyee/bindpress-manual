// renderManual(): both views, ids, and above all that nothing an author types becomes markup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderManual, renderBlock } from '../src/render.js';
import { esc, safeUrl } from '../src/escape.js';

const EVIL = '<img src=x onerror="alert(1)">';

/** A manual where every field an author can type holds markup. */
function hostileManual(kind) {
  return {
    kind, title: EVIL, subtitle: EVIL, version: EVIL, updated: '2026-11-05', theme: 'modern', numbering: 'on',
    pages: [
      { id: 'one', title: EVIL, level: 0, blocks: [
        { type: 'paragraph', text: EVIL }, { type: 'heading', text: EVIL }, { type: 'list', text: `${EVIL}\nsecond` },
        { type: 'note', tone: 'warning', text: EVIL }, { type: 'table', text: `${EVIL} | b\n${EVIL} | d` },
        { type: 'picture', fileUrl: 'javascript:alert(1)', alt: EVIL, caption: EVIL },
        { type: 'picture', fileUrl: 'https://example.com/a.png"onerror="alert(1)', alt: 'x' },
        { type: 'question', question: EVIL, text: EVIL }
      ] },
      { id: 'two', title: EVIL, level: 1, blocks: [] }
    ]
  };
}

for (const kind of ['manual', 'faq']) {
  test(`${kind}: nothing an author typed becomes markup`, () => {
    const html = renderManual(hostileManual(kind));
    assert.doesNotMatch(html, /<img src=x/);
    assert.doesNotMatch(html, /<[^>]*\sonerror=/i, 'no element carries an event handler');
    assert.doesNotMatch(html, /javascript:/i);
    assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
    assert.match(html, /src="https:\/\/example\.com\/a\.png&quot;onerror=&quot;alert\(1\)"/, 'a quote in a picture address cannot end the attribute');
    assert.match(html, /The picture is missing/, 'a refused picture shows a placeholder');
  });
}

test('the view follows the kind, unless asked for', () => {
  assert.match(renderManual({ kind: 'manual', pages: [] }), /data-manual>/);
  assert.match(renderManual({ kind: 'faq', pages: [] }), /data-faq>/);
  assert.match(renderManual({ kind: 'faq', pages: [] }, { view: 'paged' }), /data-manual>/);
  assert.match(renderManual({ kind: 'manual', pages: [] }, { view: 'faq' }), /data-faq>/);
  assert.match(renderManual({ kind: 'faq', pages: [] }, { view: 'nonsense' }), /data-faq>/);
});

test('ids are prefixed, so two manuals can share a page', () => {
  const manual = { pages: [{ id: 'intro', title: 'Intro', level: 0, blocks: [] }] };
  assert.match(renderManual(manual, { id: 'guide' }), /id="guide-intro"/);
  assert.match(renderManual(manual), /id="manual-intro"/, 'the default prefix');
  assert.match(renderManual(manual, { id: '"><script>' }), /id="manual-intro"/, 'an unusable prefix falls back to the default');
});

test('paged view: a cover, one sheet per page, contents and page numbers', () => {
  const html = renderManual({ title: 'Guide', numbering: 'on', pages: [
    { id: 'a', title: 'First', level: 0, blocks: [] }, { id: 'b', title: 'Second', level: 1, blocks: [] }
  ] });
  assert.equal(html.match(/class="x-man-sheet[ "]/g).length, 3);
  assert.match(html, /data-page="1" aria-label="Cover and contents"/);
  assert.match(html, /<span class="x-man-num">1\.1<\/span> <span>Second<\/span>/);
  assert.match(html, /Page 3 of 3/);
  assert.match(html, /data-manual-bar hidden/, 'the toolbar waits for the reader');
});

test('FAQ view: topics, a topic list, and questions with their own addresses', () => {
  const html = renderManual({ kind: 'faq', title: 'Help', numbering: 'off', pages: [
    { id: 'account', title: 'Account', level: 0, blocks: [
      { type: 'question', id: 'reset', question: 'Reset?', text: 'Yes.' },
      { type: 'question', question: 'Other?', text: 'No.' },
      { type: 'heading', text: 'More' }
    ] },
    { id: 'safety', title: 'Safety', level: 1, blocks: [{ type: 'question', question: 'Safe?', text: 'Very.' }] }
  ] }, { id: 'help' });
  assert.match(html, /<h1 class="x-man-faq-title">Help<\/h1>/);
  assert.match(html, /<nav class="x-man-faq-nav" aria-label="Topics">/);
  assert.match(html, /<a href="#help-account" data-faq-link="help-account"><span>Account<\/span><\/a><ol><li><a href="#help-safety"/, 'sections nest under their topic');
  assert.match(html, /<details class="x-man-qa" id="help-account-reset">/, 'a question with an id keeps it');
  assert.match(html, /<details class="x-man-qa" id="help-account-q2">/, 'a question without one is numbered by its place');
  assert.match(html, /<a class="x-man-qa-link" href="#help-account-reset">/);
  assert.match(html, /<h2 class="x-man-faq-topic-title" id="help-account-title" data-faq-title>/);
  assert.match(html, /<h3 class="x-man-faq-topic-title" id="help-safety-title"/, 'a section is one level below a topic');
  assert.match(html, /<h3>More<\/h3>/, 'a heading inside a topic is one level below its title');
  assert.match(html, /data-faq-tools hidden/, 'the search waits for the reader');
  assert.doesNotMatch(html, /x-man-sheet|Page \d of/, 'no sheets or page numbers');
});

test('FAQ view: an automatic question id never repeats one an author chose', () => {
  const html = renderManual({ kind: 'faq', pages: [{ id: 't', title: 'T', level: 0, blocks: [
    { type: 'question', question: 'A', text: 'a' }, { type: 'question', id: 'q1', question: 'B', text: 'b' }
  ] }] });
  const ids = [...html.matchAll(/<details class="x-man-qa" id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, 2, ids.join(', '));
});

test('FAQ view: a single topic needs no topic list', () => {
  assert.doesNotMatch(renderManual({ kind: 'faq', pages: [{ id: 't', title: 'T', level: 0, blocks: [] }] }), /x-man-faq-nav/);
});

test('edit: a summary card instead of the whole manual', () => {
  const html = renderManual({ title: 'Guide', pages: [{ id: 'a', title: 'First', level: 0, blocks: [] }] }, { edit: true });
  assert.match(html, /x-man-edit/);
  assert.match(html, /User guide · 2 pages/);
  assert.match(renderManual({ kind: 'faq', pages: [{ id: 'a', title: 'A', level: 0, blocks: [{ type: 'question', question: 'Q', text: 'A' }] }] }, { edit: true }), /Help centre · 1 question</);
});

test('renderBlock draws one block on its own', () => {
  assert.equal(renderBlock({ type: 'paragraph', text: 'a\nb' }), '<p>a<br>b</p>');
  assert.equal(renderBlock({ type: 'paragraph', text: '  ' }), '', 'an empty paragraph draws nothing');
  assert.equal(renderBlock({ type: 'heading', text: 'H' }, { headingLevel: 9 }), '<h6>H</h6>');
  assert.equal(renderBlock({ type: 'table', text: '' }), '');
});

test('esc and safeUrl', () => {
  assert.equal(esc(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(esc(null), '');
  assert.equal(safeUrl('java\tscript:alert(1)'), '#');
  assert.equal(safeUrl('JAVASCRIPT:alert(1)', true), '');
  assert.equal(safeUrl('data:text/html,<b>', true), '');
  assert.equal(safeUrl('data:image/png;base64,AAAA', true), 'data:image/png;base64,AAAA');
  assert.equal(safeUrl('data:image/png;base64,AAAA'), '#', 'data: is for pictures only');
  assert.equal(safeUrl('mailto:a@b.c'), 'mailto:a@b.c');
  assert.equal(safeUrl('mailto:a@b.c', true), '');
  assert.equal(safeUrl('/pictures/a.png', true), '/pictures/a.png');
  assert.equal(safeUrl('https://example.com/a.png', true), 'https://example.com/a.png');
});
