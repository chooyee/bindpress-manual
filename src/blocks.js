/**
 * One content block → HTML, for both views (paged and FAQ). Everything an author typed goes
 * through esc(), and picture addresses through safeUrl().
 */
import { esc, safeUrl } from './escape.js';
import { parseTableRows, parseListItems } from './model.js';

/**
 * Plain text with its line breaks kept.
 * @param {string} value
 * @returns {string} HTML
 */
export const lines = (value) => esc(value).replace(/\n/g, '<br>');

/**
 * @typedef {object} BlockOptions
 * @property {() => string} [nextFigureLabel]  gives "Figure 2.1", "Figure 2.2", ... for pictures
 * @property {number} [headingLevel]  the <h…> level of a heading block (3 when left out)
 * @property {string} [questionId]  an id for a question, so its answer can be linked to (FAQ view)
 */

/**
 * Renders one piece of content.
 * @param {import('./model.js').Block} block  a normalized block
 * @param {BlockOptions} [options]
 * @returns {string} HTML
 */
export function renderBlock(block, options = {}) {
  const { nextFigureLabel = () => 'Figure', headingLevel = 3, questionId } = options;
  switch (block.type) {
    case 'heading': {
      const tag = `h${Math.min(Math.max(headingLevel, 2), 6)}`;
      return `<${tag}>${esc(block.text)}</${tag}>`;
    }
    case 'list': {
      const tag = block.style === 'numbered' ? 'ol' : 'ul';
      return `<${tag}>${parseListItems(block.text).map(item => `<li>${esc(item)}</li>`).join('')}</${tag}>`;
    }
    case 'note':
      return `<div class="x-man-note x-man-note-${block.tone}"><span class="x-man-note-label">${block.tone === 'warning' ? 'Important' : 'Note'}</span>${lines(block.text)}</div>`;
    case 'table': {
      const [header = [], ...rows] = parseTableRows(block.text);
      if (!header.length) return '';
      return `<div class="x-man-table"><table><thead><tr>${header.map(cell => `<th>${esc(cell)}</th>`).join('')}</tr></thead>` +
        `<tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    case 'picture': {
      const label = nextFigureLabel();
      const src = safeUrl(block.fileUrl || '', true);
      // Not loading="lazy": a sheet stays hidden until the reader turns to it, and signed storage
      // addresses (S3, Azure) often expire within minutes, so a picture fetched late would fail.
      const picture = src ? `<img src="${esc(src)}" alt="${esc(block.alt)}">` : '<div class="x-man-no-picture">The picture is missing</div>';
      return `<figure class="x-man-figure x-man-size-${block.size} x-man-align-${block.align}">${picture}<figcaption><span class="x-man-figure-label">${label}</span> ${esc(block.caption)}</figcaption></figure>`;
    }
    case 'question': {
      if (!questionId) return `<details class="x-man-qa"><summary>${esc(block.question)}</summary><div class="x-man-answer">${lines(block.text)}</div></details>`;
      return `<details class="x-man-qa" id="${questionId}"><summary><span>${esc(block.question)}</span></summary><div class="x-man-answer">${lines(block.text)}` +
        `<a class="x-man-qa-link" href="#${questionId}">Link to this answer</a></div></details>`;
    }
    default:
      return block.text.trim() ? `<p>${lines(block.text)}</p>` : '';
  }
}
