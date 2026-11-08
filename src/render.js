/**
 * Manual → HTML. The one function most users need: renderManual().
 *
 * It cleans the input first (normalizeManual), so any JSON is safe to pass: everything an author
 * typed is escaped, picture addresses are checked, and the HTML can go on a page as it is.
 * A manual is drawn as the paged view (render-paged.js) and an FAQ as the FAQ view
 * (render-faq.js); the `view` option chooses for you.
 */
import { esc } from './escape.js';
import { normalizeManual, outline } from './model.js';
import { renderPaged, kindLabel } from './render-paged.js';
import { renderFaq } from './render-faq.js';

export { renderBlock } from './blocks.js';

/**
 * @typedef {object} RenderOptions
 * @property {string} [id]  prefix for the ids in the HTML, so two manuals can share a page. Letters, digits, "-" and "_"; "manual" when left out or not valid
 * @property {'auto' | 'paged' | 'faq'} [view]  auto (the default): an FAQ gets the FAQ view, a manual the paged view
 * @property {boolean} [edit]  true: a short summary card instead, for an editor's canvas
 */

/**
 * Renders a manual or FAQ.
 * @param {unknown} manual  the manual JSON (see docs/format.html); it does not have to be clean
 * @param {RenderOptions} [options]
 * @returns {string} HTML
 */
export function renderManual(manual, options = {}) {
  const clean = normalizeManual(manual);
  const entries = outline(clean);
  const blockId = /^[A-Za-z0-9_-]+$/.test(options.id || '') ? /** @type {string} */ (options.id) : 'manual';
  const classes = `x-man x-man-theme-${clean.theme} x-man-kind-${clean.kind}`;
  if (options.edit) return `<div class="${classes} x-man-edit">${renderSummary(clean, entries)}</div>`;
  const view = options.view === 'paged' || options.view === 'faq' ? options.view : (clean.kind === 'faq' ? 'faq' : 'paged');
  return view === 'faq' ? renderFaq(clean, entries, blockId, classes) : renderPaged(clean, entries, blockId, classes);
}

/**
 * The editor card: what the manual is, and its first levels.
 * @param {import('./model.js').Manual} manual
 * @param {import('./model.js').OutlineEntry[]} entries
 */
function renderSummary(manual, entries) {
  const shown = entries.filter(entry => entry.page.level <= 1);
  const rows = shown.slice(0, 10).map(entry => {
    const number = manual.numbering === 'on' ? entry.number : '';
    return `<li class="${entry.page.level ? 'x-man-sub' : ''}">${number ? `<span class="x-man-num">${number}</span> ` : ''}${esc(entry.page.title)}</li>`;
  }).join('');
  const more = shown.length > 10 ? `<li class="x-man-more">and ${shown.length - 10} more</li>` : '';
  const questions = entries.reduce((count, entry) => count + entry.page.blocks.filter(block => block.type === 'question').length, 0);
  const size = manual.kind === 'faq' ? `${questions} ${questions === 1 ? 'question' : 'questions'}` : `${entries.length + 1} pages`;
  return `<div class="x-man-card"><div class="x-man-eyebrow">${kindLabel(manual)} · ${size}</div>` +
    `<div class="x-man-card-title">${esc(manual.title || 'Untitled manual')}</div>${manual.subtitle ? `<p>${esc(manual.subtitle)}</p>` : ''}` +
    `<ol class="x-man-card-outline">${rows}${more}</ol></div>`;
}
