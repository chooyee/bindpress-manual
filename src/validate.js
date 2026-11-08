/**
 * Checks a manual against the format and says what is wrong, in words a person can act on.
 *
 * The views never need this: renderManual() cleans whatever it gets (normalizeManual). Use it
 * where the JSON comes in (an import, an API, a build step) so authors hear about a typo
 * instead of seeing a page quietly drop it. It follows schema/manual.schema.json, and a test
 * keeps the two in step.
 *
 * Fields the format does not know are allowed and ignored, so newer data still passes in older
 * code.
 */
import { KINDS, THEMES, BLOCK_TYPES, LIST_STYLES, NOTE_TONES, PICTURE_SIZES, PICTURE_ALIGNS, MAX_LEVEL, ID_PATTERN, DATE_PATTERN } from './model.js';

/**
 * @typedef {object} ValidationError
 * @property {string} path  where the problem is, such as "pages[2].blocks[0].type"
 * @property {string} message  what is wrong
 *
 * @typedef {object} ValidationResult
 * @property {boolean} valid
 * @property {ValidationError[]} errors  empty when valid
 */

/** @param {unknown} value @returns {value is Record<string, any>} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
/** @param {readonly string[]} list */
const listed = (list) => list.map(item => `"${item}"`).join(', ');

/**
 * Checks a manual.
 * @param {unknown} manual  the manual as received, before normalizeManual()
 * @returns {ValidationResult}
 */
export function validateManual(manual) {
  /** @type {ValidationError[]} */
  const errors = [];
  /** @param {string} path @param {string} message */
  const fail = (path, message) => { errors.push({ path, message }); };
  /** @param {Record<string, unknown>} object @param {string} key @param {string} path */
  const checkString = (object, key, path) => {
    if (key in object && typeof object[key] !== 'string') fail(path, 'must be a string');
  };
  /** @param {Record<string, unknown>} object @param {string} key @param {readonly string[]} allowed @param {string} path */
  const checkOneOf = (object, key, allowed, path) => {
    if (key in object && !allowed.includes(/** @type {string} */ (object[key]))) fail(path, `must be one of ${listed(allowed)}`);
  };

  if (!isObject(manual)) {
    fail('', 'a manual must be a JSON object');
    return { valid: false, errors };
  }
  const root = /** @type {Record<string, unknown>} */ (manual);
  checkOneOf(root, 'kind', KINDS, 'kind');
  if (!('title' in root)) fail('title', 'is required');
  for (const key of ['title', 'subtitle', 'version']) checkString(root, key, key);
  if ('updated' in root && root.updated !== '' && !isRealDate(root.updated)) fail('updated', 'must be a date written YYYY-MM-DD, or ""');
  checkOneOf(root, 'theme', THEMES, 'theme');
  checkOneOf(root, 'numbering', ['on', 'off'], 'numbering');

  if (!Array.isArray(root.pages)) {
    fail('pages', 'is required, and must be a list of pages');
    return { valid: false, errors };
  }
  const pageIds = new Set();
  let previousLevel = -1;
  root.pages.forEach((page, pageIndex) => {
    const at = `pages[${pageIndex}]`;
    if (!isObject(page)) { fail(at, 'must be an object'); return; }
    if (typeof page.id !== 'string' || !ID_PATTERN.test(page.id)) fail(`${at}.id`, 'is required: 1 to 40 letters, digits, "-" or "_"');
    else if (pageIds.has(page.id)) fail(`${at}.id`, `"${page.id}" is used by an earlier page; ids must be unique`);
    else pageIds.add(page.id);
    if (!('title' in page)) fail(`${at}.title`, 'is required');
    checkString(page, 'title', `${at}.title`);
    if (!Number.isInteger(page.level) || page.level < 0 || page.level > MAX_LEVEL) {
      fail(`${at}.level`, `is required: a whole number from 0 to ${MAX_LEVEL}`);
    } else {
      if (page.level > previousLevel + 1) {
        fail(`${at}.level`, pageIndex === 0 ? 'the first page must be a chapter (level 0)' : `is ${page.level}, but a page can sit at most one level below the page before it (${previousLevel})`);
      }
      previousLevel = page.level;
    }
    if (!Array.isArray(page.blocks)) { fail(`${at}.blocks`, 'is required, and must be a list (it may be empty)'); return; }
    const questionIds = new Set();
    page.blocks.forEach((/** @type {unknown} */ block, /** @type {number} */ blockIndex) => {
      const blockAt = `${at}.blocks[${blockIndex}]`;
      if (!isObject(block)) { fail(blockAt, 'must be an object'); return; }
      if (!BLOCK_TYPES.includes(block.type)) { fail(`${blockAt}.type`, `must be one of ${listed(BLOCK_TYPES)}`); return; }
      checkString(block, 'text', `${blockAt}.text`);
      if (block.type === 'list') checkOneOf(block, 'style', LIST_STYLES, `${blockAt}.style`);
      if (block.type === 'note') checkOneOf(block, 'tone', NOTE_TONES, `${blockAt}.tone`);
      if (block.type === 'question') {
        if (typeof block.question !== 'string' || !block.question.trim()) fail(`${blockAt}.question`, 'is required for a question');
        if ('id' in block) {
          if (typeof block.id !== 'string' || !ID_PATTERN.test(block.id)) fail(`${blockAt}.id`, 'must be 1 to 40 letters, digits, "-" or "_"');
          else if (questionIds.has(block.id)) fail(`${blockAt}.id`, `"${block.id}" is used by an earlier question on this page`);
          else questionIds.add(block.id);
        }
      }
      if (block.type === 'picture') {
        for (const key of ['fileUrl', 'fileId', 'alt', 'caption']) checkString(block, key, `${blockAt}.${key}`);
        checkOneOf(block, 'size', PICTURE_SIZES, `${blockAt}.size`);
        checkOneOf(block, 'align', PICTURE_ALIGNS, `${blockAt}.align`);
      }
    });
  });
  return { valid: errors.length === 0, errors };
}

/** @param {unknown} value  YYYY-MM-DD that names a day that exists (not 2026-02-30) */
function isRealDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
