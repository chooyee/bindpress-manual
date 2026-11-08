/**
 * The paged view: a manual drawn as a document of A4-shaped sheets, with a cover and contents.
 *
 * The HTML holds every sheet, the contents tree and a toolbar marked `hidden`. On its own it
 * reads as one long document, which is also what printing gives (each sheet on its own paper).
 * A page that loads reader.js turns it into the PDF-style reader: one sheet at a time, search,
 * page numbers, zoom and full screen. The data-* attributes are what reader.js looks for.
 */
import { esc } from './escape.js';
import { buildTree, groupEnd, formatDate } from './model.js';
import { renderBlock } from './blocks.js';

/**
 * @typedef {object} PagedView
 * @property {import('./model.js').Manual} manual
 * @property {import('./model.js').OutlineEntry[]} entries
 * @property {string} blockId
 * @property {number} total  sheets, counting the cover
 */

const ICONS = {
  contents: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  previous: '<path d="m15 6-6 6 6 6"/>',
  next: '<path d="m9 6 6 6-6 6"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  print: '<path d="M7 9V3h10v6M7 18H4v-8h16v8h-3M7 14h10v7H7z"/>'
};
/** @param {keyof typeof ICONS} name */
export const svgIcon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
/** @param {string} action @param {string} label @param {keyof typeof ICONS} iconName @param {string} [extraClass] */
const button = (action, label, iconName, extraClass = '') =>
  `<button type="button" class="x-man-btn ${extraClass}" data-action="${action}" title="${label}" aria-label="${label}">${svgIcon(iconName)}</button>`;

/** The address of a sheet inside the page: #<block id>-<page id>. */
const sheetId = (/** @type {PagedView} */ view, /** @type {string} */ pageId) => `${view.blockId}-${pageId}`;
const shownNumber = (/** @type {PagedView} */ view, /** @type {import('./model.js').OutlineEntry | undefined} */ entry) =>
  (view.manual.numbering === 'on' && entry ? entry.number : '');
/** @param {import('./model.js').Manual} manual */
export const kindLabel = (manual) => (manual.kind === 'faq' ? 'Help centre' : 'User guide');

/**
 * Renders the paged view.
 * @param {import('./model.js').Manual} manual  normalized
 * @param {import('./model.js').OutlineEntry[]} entries  outline(manual)
 * @param {string} blockId  a safe id, the prefix of every sheet's id
 * @param {string} classes  the outer element's classes
 * @returns {string} HTML
 */
export function renderPaged(manual, entries, blockId, classes) {
  const view = { manual, entries, blockId, total: entries.length + 1 };
  return `<div class="${classes}" data-manual>${renderBar(view)}<div class="x-man-body">${renderNav(view)}` +
    `<div class="x-man-viewport" data-manual-viewport>${renderCover(view)}${entries.map(entry => renderSheet(view, entry)).join('')}</div></div></div>`;
}

/** @param {PagedView} view */
function renderBar(view) {
  return `<div class="x-man-bar" data-manual-bar hidden>
${button('contents', 'Contents', 'contents')}<span class="x-man-bar-title">${esc(view.manual.title)}</span><span class="x-man-spacer"></span>
<div class="x-man-search" role="search"><input type="search" data-search placeholder="Search this document" aria-label="Search this document" autocomplete="off">` +
    `<span class="x-man-count" data-search-count aria-live="polite"></span>${button('match-previous', 'Previous match', 'up')}${button('match-next', 'Next match', 'down')}</div>
${button('search', 'Search', 'search', 'x-man-search-toggle')}
<span class="x-man-pager">${button('previous', 'Previous page', 'previous')}<input data-page-input inputmode="numeric" aria-label="Page number" value="1">` +
    `<span class="x-man-total" data-page-total>/ ${view.total}</span>${button('next', 'Next page', 'next')}</span>
<span class="x-man-zoom">${button('zoom-out', 'Zoom out', 'minus')}<span class="x-man-zoom-label" data-zoom-label>100%</span>${button('zoom-in', 'Zoom in', 'plus')}</span>
${button('full', 'Full screen', 'full')}${button('print', 'Print or save as PDF', 'print')}</div>`;
}

/** @param {PagedView} view */
function renderNav(view) {
  /** @param {import('./model.js').OutlineEntry} entry */
  const link = (entry) => {
    const number = shownNumber(view, entry);
    return `<a href="#${sheetId(view, entry.page.id)}" data-page-link="${entry.pageNumber}">${number ? `<span class="x-man-num">${number}</span> ` : ''}<span>${esc(entry.page.title)}</span></a>`;
  };
  /** @param {import('./model.js').TreeNode<import('./model.js').OutlineEntry>[]} nodes @returns {string} */
  const items = (nodes) => nodes.map(node => `<li>${link(node.entry)}${node.children.length ? `<ol>${items(node.children)}</ol>` : ''}</li>`).join('');
  return `<nav class="x-man-nav" aria-label="Contents" data-manual-nav><div class="x-man-results" data-search-results hidden></div>` +
    `<ol class="x-man-tree"><li><a href="#${sheetId(view, 'cover')}" data-page-link="1"><span>Cover and contents</span></a></li>${items(buildTree(view.entries))}</ol></nav>`;
}

/** @param {PagedView} view @param {number} pageNumber */
function renderFoot(view, pageNumber) {
  const left = [view.manual.version, formatDate(view.manual.updated)].filter(Boolean).map(esc).join(' · ');
  return `<footer class="x-man-run x-man-foot"><span>${left}</span><span>Page ${pageNumber} of ${view.total}</span></footer>`;
}

/** @param {PagedView} view */
function renderCover(view) {
  const { manual } = view;
  const updated = formatDate(manual.updated);
  const contents = view.entries.filter(entry => entry.page.level <= 1).map(entry => {
    const number = shownNumber(view, entry);
    return `<a class="x-man-toc ${entry.page.level === 0 ? 'x-man-toc-top' : 'x-man-toc-sub'}" href="#${sheetId(view, entry.page.id)}" data-page-link="${entry.pageNumber}">` +
      `${number ? `<span class="x-man-num">${number}</span> ` : ''}<span class="x-man-toc-title">${esc(entry.page.title)}</span><span class="x-man-dots"></span><span class="x-man-toc-page">${entry.pageNumber}</span></a>`;
  }).join('');
  return `<section class="x-man-sheet x-man-cover" id="${sheetId(view, 'cover')}" data-page="1" aria-label="Cover and contents">
<div class="x-man-band"></div><div class="x-man-sheet-body">
<div class="x-man-eyebrow">${kindLabel(manual)}</div><h1 class="x-man-cover-title">${esc(manual.title)}</h1>` +
    `${manual.subtitle ? `<p class="x-man-cover-sub">${esc(manual.subtitle)}</p>` : ''}
<div class="x-man-cover-meta">${manual.version ? `<span>${esc(manual.version)}</span>` : ''}${updated ? `<span>Last updated ${esc(updated)}</span>` : ''}<span>${view.total} pages</span></div>
${contents ? `<div class="x-man-eyebrow">Contents</div><nav class="x-man-contents" aria-label="Contents">${contents}</nav>` : ''}</div>${renderFoot(view, 1)}</section>`;
}

/** @param {PagedView} view @param {import('./model.js').OutlineEntry} entry */
function renderSheet(view, entry) {
  const { manual, entries } = view;
  const { page } = entry;
  const number = shownNumber(view, entry);
  const chapterEntry = entries.find(item => item.page === entry.chapter);
  const chapterLabel = [shownNumber(view, chapterEntry), entry.chapter.title].filter(Boolean).join(' ');
  const headingId = `${sheetId(view, page.id)}-title`;
  const eyebrow = page.level === 0
    ? `<div class="x-man-eyebrow">${manual.numbering === 'on' ? `Chapter ${number}` : (manual.kind === 'faq' ? 'Topic' : 'Chapter')}</div><div class="x-man-rule"></div>` : '';
  let figure = entry.figureStart;
  const nextFigureLabel = () => `Figure ${manual.numbering === 'on' ? `${number.split('.')[0]}.` : ''}${++figure}`;
  const blocks = page.blocks.map(block => renderBlock(block, { nextFigureLabel })).join('');
  return `<section class="x-man-sheet" id="${sheetId(view, page.id)}" data-page="${entry.pageNumber}" aria-labelledby="${headingId}">
<header class="x-man-run"><span>${esc(manual.title)}</span><span>${esc(chapterLabel)}</span></header><div class="x-man-sheet-body">
${eyebrow}<h2 id="${headingId}">${number ? `<span class="x-man-num">${number}</span> ` : ''}<span>${esc(page.title)}</span></h2>
${blocks}${renderChildren(view, entry)}${renderPreviousNext(view, entry)}</div>${renderFoot(view, entry.pageNumber)}</section>`;
}

/** "In this section": links to the page's direct sub-pages. */
function renderChildren(/** @type {PagedView} */ view, /** @type {import('./model.js').OutlineEntry} */ entry) {
  const pages = view.manual.pages;
  const end = groupEnd(pages, entry.index);
  const children = view.entries.slice(entry.index + 1, end).filter(child => child.page.level === entry.page.level + 1);
  if (!children.length) return '';
  return `<nav class="x-man-children" aria-label="In this section"><div class="x-man-eyebrow">In this section</div>${children.map(child => {
    const number = shownNumber(view, child);
    return `<a href="#${sheetId(view, child.page.id)}" data-page-link="${child.pageNumber}">${number ? `<span class="x-man-num">${number}</span> ` : ''}<span>${esc(child.page.title)}</span></a>`;
  }).join('')}</nav>`;
}

/** @typedef {{ id: string, title: string, number: string, pageNumber: number }} SheetLink */

function renderPreviousNext(/** @type {PagedView} */ view, /** @type {import('./model.js').OutlineEntry} */ entry) {
  const previous = entry.index === 0 ? { id: 'cover', title: 'Cover and contents', number: '', pageNumber: 1 } : null;
  const before = previous || toLink(view, view.entries[entry.index - 1]);
  const after = toLink(view, view.entries[entry.index + 1]);
  /** @param {SheetLink | null} item @param {string} label @param {string} className */
  const link = (item, label, className) => (item
    ? `<a class="${className}" href="#${sheetId(view, item.id)}" data-page-link="${item.pageNumber}"><small>${label}</small>${esc([item.number, item.title].filter(Boolean).join(' '))}</a>` : '');
  return `<nav class="x-man-prevnext" aria-label="Previous and next page">${link(before, '← Previous', 'x-man-previous')}${link(after, 'Next →', 'x-man-next')}</nav>`;
}
/** @returns {SheetLink | null} */
const toLink = (/** @type {PagedView} */ view, /** @type {import('./model.js').OutlineEntry | undefined} */ entry) =>
  (entry ? { id: entry.page.id, title: entry.page.title, number: shownNumber(view, entry), pageNumber: entry.pageNumber } : null);
