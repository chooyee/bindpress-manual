/**
 * @bindpress/manual: render a user manual or FAQ, written as one JSON document, to safe HTML.
 *
 * This entry is for servers and build steps (and works in browsers too). The browser reader is
 * a separate entry, '@bindpress/manual/reader', and the styles are '@bindpress/manual/manual.css'.
 */

/**
 * The data shapes, for TypeScript and JSDoc users.
 * @typedef {import('./model.js').Manual} Manual
 * @typedef {import('./model.js').Page} Page
 * @typedef {import('./model.js').Block} Block
 * @typedef {import('./model.js').OutlineEntry} OutlineEntry
 * @typedef {import('./render.js').RenderOptions} RenderOptions
 * @typedef {import('./validate.js').ValidationResult} ValidationResult
 * @typedef {import('./validate.js').ValidationError} ValidationError
 */

export { renderManual, renderBlock } from './render.js';
export { validateManual } from './validate.js';
export { faqJsonLd } from './structured-data.js';
export { esc, safeUrl } from './escape.js';
export {
  normalizeManual, normalizeBlock, outline, buildTree, groupEnd, allowedMoves, movePage, addPage, removePage,
  parseTableRows, parseListItems, formatDate, newPageId, sampleManual, sampleFaq,
  KINDS, THEMES, BLOCK_TYPES, LIST_STYLES, NOTE_TONES, PICTURE_SIZES, PICTURE_ALIGNS, MAX_LEVEL, ID_PATTERN, DATE_PATTERN
} from './model.js';
