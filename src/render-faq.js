/**
 * The FAQ view: a help centre on one scrolling page. Topics are listed on the left, each topic
 * is a group of questions that open and close, and every answer has its own address
 * (#<block id>-<topic id>-<question id>).
 *
 * There is no cover, page numbers or paper: people come to an FAQ to find one answer fast. On
 * its own the HTML works fully (the topic links are plain anchors, the questions are <details>).
 * A page that loads reader.js adds search that filters as you type, Expand all / Collapse all,
 * the current topic marked in the list, and opening the question an address points to.
 */
import { esc } from './escape.js';
import { buildTree, formatDate } from './model.js';
import { renderBlock } from './blocks.js';
import { svgIcon } from './render-paged.js';

/**
 * Renders the FAQ view.
 * @param {import('./model.js').Manual} manual  normalized
 * @param {import('./model.js').OutlineEntry[]} entries  outline(manual)
 * @param {string} blockId  a safe id, the prefix of every topic's and question's id
 * @param {string} classes  the outer element's classes
 * @returns {string} HTML
 */
export function renderFaq(manual, entries, blockId, classes) {
  const meta = [manual.version, formatDate(manual.updated) && `Last updated ${formatDate(manual.updated)}`].filter(Boolean).map(item => `<span>${esc(item)}</span>`).join('');
  return `<div class="${classes} x-man-faq" data-faq>
<header class="x-man-faq-head"><div class="x-man-eyebrow">Help centre</div><h1 class="x-man-faq-title">${esc(manual.title)}</h1>` +
    `${manual.subtitle ? `<p class="x-man-faq-sub">${esc(manual.subtitle)}</p>` : ''}${meta ? `<div class="x-man-faq-meta">${meta}</div>` : ''}
<div class="x-man-faq-tools" data-faq-tools hidden><div class="x-man-faq-search" role="search">${svgIcon('search')}` +
    `<input type="search" data-faq-search placeholder="Search the questions" aria-label="Search the questions" autocomplete="off"></div>` +
    `<span class="x-man-faq-count" data-faq-count aria-live="polite"></span><span class="x-man-spacer"></span>` +
    `<button type="button" class="x-man-faq-button" data-faq-action="expand">Expand all</button><button type="button" class="x-man-faq-button" data-faq-action="collapse">Collapse all</button></div></header>
<div class="x-man-faq-body${entries.length > 1 ? ' has-nav' : ''}">${entries.length > 1 ? renderTopicList(manual, entries, blockId) : ''}<div class="x-man-faq-main">` +
    `${entries.map(entry => renderTopic(manual, entry, blockId)).join('')}<p class="x-man-faq-empty" data-faq-empty hidden></p></div></div></div>`;
}

/** The list of topics: chapters and their sections, two levels deep. */
function renderTopicList(/** @type {import('./model.js').Manual} */ manual, /** @type {import('./model.js').OutlineEntry[]} */ entries, /** @type {string} */ blockId) {
  /** @param {import('./model.js').TreeNode<import('./model.js').OutlineEntry>[]} nodes @returns {string} */
  const items = (nodes) => nodes.map(({ entry, children }) => {
    const number = manual.numbering === 'on' ? `<span class="x-man-num">${entry.number}</span> ` : '';
    const sub = children.length ? `<ol>${items(children)}</ol>` : '';
    return `<li><a href="#${blockId}-${entry.page.id}" data-faq-link="${blockId}-${entry.page.id}">${number}<span>${esc(entry.page.title)}</span></a>${sub}</li>`;
  }).join('');
  return `<nav class="x-man-faq-nav" aria-label="Topics"><ol>${items(buildTree(entries.filter(entry => entry.page.level <= 1)))}</ol></nav>`;
}

/** One topic: its title, then its content in order. Questions get ids so answers can be linked to. */
function renderTopic(/** @type {import('./model.js').Manual} */ manual, /** @type {import('./model.js').OutlineEntry} */ entry, /** @type {string} */ blockId) {
  const { page } = entry;
  const topicId = `${blockId}-${page.id}`;
  // Topics are h2, sections h3 and so on; a heading typed inside a topic is one level below it.
  const titleLevel = Math.min(2 + page.level, 6);
  const number = manual.numbering === 'on' ? `<span class="x-man-num">${entry.number}</span> ` : '';
  let figure = entry.figureStart;
  const nextFigureLabel = () => `Figure ${manual.numbering === 'on' ? `${entry.number.split('.')[0]}.` : ''}${++figure}`;
  let questionCount = 0;
  const usedIds = new Set(page.blocks.map(block => block.id).filter(Boolean));
  const blocks = page.blocks.map(block => {
    if (block.type !== 'question') return renderBlock(block, { nextFigureLabel, headingLevel: titleLevel + 1 });
    questionCount++;
    let id = block.id;
    // Without an id of its own, a question is numbered by its place: q1, q2, ...
    if (!id) { id = `q${questionCount}`; while (usedIds.has(id)) id = `${id}-${questionCount}`; usedIds.add(id); }
    return renderBlock(block, { questionId: `${topicId}-${id}` });
  }).join('');
  return `<section class="x-man-faq-topic x-man-faq-level-${Math.min(page.level, 2)}" id="${topicId}" data-faq-topic aria-labelledby="${topicId}-title">` +
    `<h${titleLevel} class="x-man-faq-topic-title" id="${topicId}-title" data-faq-title>${number}<span>${esc(page.title)}</span></h${titleLevel}>${blocks}</section>`;
}
