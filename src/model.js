/**
 * The shape of a manual, and the tree operations an editor needs. Pure functions with no DOM, so
 * they run on a server, in a browser and in tests alike.
 *
 * A manual (or FAQ) is one JSON object:
 *
 *   { kind: 'manual' | 'faq', title, subtitle, version, updated: 'YYYY-MM-DD',
 *     theme: 'classic' | 'modern' | 'friendly', numbering: 'on' | 'off',
 *     pages: [{ id, title, level, blocks: [{ type, text, ... }] }] }
 *
 * The tree is stored as a flat list in reading order, where `level` says how deep each page sits
 * (0 = chapter, 1 = section, ...). A flat list is easy to validate, describe as JSON Schema and
 * read in any language; the nesting is rebuilt with buildTree(). A page's sub-pages are the pages
 * after it with a higher level, up to the next page at its own level or above.
 *
 * The full format, with examples, is in docs/format.html and schema/manual.schema.json.
 */

/**
 * @typedef {'manual' | 'faq'} Kind
 * @typedef {'classic' | 'modern' | 'friendly'} Theme
 * @typedef {'paragraph' | 'heading' | 'list' | 'note' | 'table' | 'picture' | 'question'} BlockType
 *
 * @typedef {object} Block  One piece of content on a page. Which fields matter depends on `type`.
 * @property {BlockType} type
 * @property {string} text  plain text; a list has one item per line, a table one row per line with cells split by "|", a question holds its answer here
 * @property {'bullets' | 'numbered'} [style]  list only
 * @property {'info' | 'warning'} [tone]  note only
 * @property {string} [question]  question only: the question itself
 * @property {string} [id]  question only, optional: a stable id for links to the answer (letters, digits, "-" and "_")
 * @property {string} [fileUrl]  picture only: the address of the image
 * @property {string} [fileId]  picture only: your own reference to the file (the renderer does not use it)
 * @property {string} [alt]  picture only: what it shows, for people who cannot see it
 * @property {string} [caption]  picture only
 * @property {'full' | 'medium' | 'small'} [size]  picture only
 * @property {'center' | 'left' | 'right'} [align]  picture only
 *
 * @typedef {object} Page  A chapter, section or topic.
 * @property {string} id  letters, digits, "-" and "_"; used in addresses
 * @property {string} title
 * @property {number} level  0 = chapter (or FAQ topic), 1 = section, ... up to MAX_LEVEL
 * @property {Block[]} blocks
 *
 * @typedef {object} Manual  A manual after normalizeManual(): every field is present.
 * @property {Kind} kind
 * @property {string} title
 * @property {string} subtitle
 * @property {string} version
 * @property {string} updated  YYYY-MM-DD, or ''
 * @property {Theme} theme
 * @property {'on' | 'off'} numbering
 * @property {Page[]} pages
 *
 * @typedef {object} OutlineEntry  What the views show about one page.
 * @property {Page} page
 * @property {number} index  its place in `pages`
 * @property {number} pageNumber  its sheet number in the paged view (the cover is 1)
 * @property {string} number  its outline number, such as "2.1.3"
 * @property {Page} chapter  the chapter (level 0 page) it belongs to
 * @property {number} figureStart  how many figures come before it, for numbering pictures
 */

export const KINDS = /** @type {const} */ (['manual', 'faq']);
export const THEMES = /** @type {const} */ (['classic', 'modern', 'friendly']);
export const BLOCK_TYPES = /** @type {const} */ (['paragraph', 'heading', 'list', 'note', 'table', 'picture', 'question']);
export const LIST_STYLES = /** @type {const} */ (['bullets', 'numbered']);
export const NOTE_TONES = /** @type {const} */ (['info', 'warning']);
export const PICTURE_SIZES = /** @type {const} */ (['full', 'medium', 'small']);
/** Where a picture narrower than the page sits. Center first: the default. */
export const PICTURE_ALIGNS = /** @type {const} */ (['center', 'left', 'right']);
/** Chapter, section, sub-section and three more. Deeper trees are hard to find your way in. */
export const MAX_LEVEL = 5;
/** What a page id, or a question id, may hold. They end up in addresses (#manual-<id>). */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** @param {unknown} value */
const text = (value) => (typeof value === 'string' ? value : '');
/**
 * @template {string} T
 * @param {unknown} value
 * @param {readonly T[]} allowed
 * @returns {T}
 */
const oneOf = (value, allowed) => (allowed.includes(/** @type {T} */ (value)) ? /** @type {T} */ (value) : allowed[0]);

/**
 * A new, unique-enough id for a page. Used in addresses, so letters and digits only.
 * @returns {string}
 */
export function newPageId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * A small manual to start from: two chapters, a section and a few kinds of content.
 * @returns {Manual}
 */
export function sampleManual() {
  return {
    kind: 'manual', title: 'User guide', subtitle: 'How to use our services', version: '', updated: '',
    theme: 'classic', numbering: 'on',
    pages: [
      { id: 'start', title: 'Getting started', level: 0, blocks: [{ type: 'paragraph', text: 'Say who this guide is for and what it covers.' }] },
      { id: 'first', title: 'Your first steps', level: 1, blocks: [{ type: 'list', style: 'numbered', text: 'Sign in.\nOpen your profile.\nCheck your details.' }] }
    ]
  };
}

/**
 * A small FAQ to start from: two topics of questions.
 * @returns {Manual}
 */
export function sampleFaq() {
  return {
    kind: 'faq', title: 'Help centre', subtitle: 'Answers to the questions we hear most', version: '', updated: '',
    theme: 'modern', numbering: 'off',
    pages: [
      { id: 'account', title: 'Your account', level: 0, blocks: [
        { type: 'question', id: 'sign-in', question: 'How do I sign in?', text: 'Choose Sign in at the top of any page and enter your email address.' },
        { type: 'question', id: 'password', question: 'I forgot my password. What now?', text: 'Choose Forgot password on the sign-in page. We email you a link that works for one hour.' }
      ] },
      { id: 'payments', title: 'Payments', level: 0, blocks: [
        { type: 'question', question: 'Which cards do you accept?', text: 'Visa, Mastercard and American Express.' }
      ] }
    ]
  };
}

/**
 * Cleans one content block: unknown types become paragraphs, every field is a string, and
 * fields that do not belong to the type are dropped.
 * @param {unknown} block
 * @returns {Block}
 */
export function normalizeBlock(block) {
  const source = /** @type {Record<string, unknown>} */ (block && typeof block === 'object' ? block : {});
  const type = oneOf(source.type, BLOCK_TYPES);
  /** @type {Block} */
  const clean = { type, text: text(source.text) };
  if (type === 'list') clean.style = oneOf(source.style, LIST_STYLES);
  if (type === 'note') clean.tone = oneOf(source.tone, NOTE_TONES);
  if (type === 'question') {
    clean.question = text(source.question);
    if (typeof source.id === 'string' && ID_PATTERN.test(source.id)) clean.id = source.id;
  }
  if (type === 'picture') {
    Object.assign(clean, { fileId: text(source.fileId), alt: text(source.alt), caption: text(source.caption), size: oneOf(source.size, PICTURE_SIZES), align: oneOf(source.align, PICTURE_ALIGNS) });
    if (typeof source.fileUrl === 'string') clean.fileUrl = source.fileUrl;
  }
  return clean;
}

/**
 * Cleans a manual so the views and an editor can trust its shape. It never throws: whatever
 * comes in, a manual comes out. Levels are kept in order: the first page is a chapter, and no
 * page sits more than one level below the page before it. Missing or repeated page ids get new
 * ones. Use validateManual() to find out what was wrong instead.
 * @param {unknown} raw  the manual as stored or received
 * @returns {Manual} a manual with every field present
 */
export function normalizeManual(raw) {
  const source = /** @type {Record<string, unknown>} */ (raw && typeof raw === 'object' ? raw : {});
  const seen = new Set();
  let previousLevel = -1;
  const rawPages = Array.isArray(source.pages) ? source.pages : [];
  const pages = rawPages.filter(page => page && typeof page === 'object').map(page => {
    const wanted = Number.isInteger(page.level) ? page.level : 0;
    const level = Math.max(0, Math.min(wanted, previousLevel + 1, MAX_LEVEL));
    previousLevel = level;
    let id = typeof page.id === 'string' && ID_PATTERN.test(page.id) ? page.id : newPageId();
    while (seen.has(id)) id = newPageId();
    seen.add(id);
    return { id, title: text(page.title), level, blocks: (Array.isArray(page.blocks) ? page.blocks : []).map(normalizeBlock) };
  });
  return {
    kind: oneOf(source.kind, KINDS),
    title: text(source.title), subtitle: text(source.subtitle), version: text(source.version),
    updated: typeof source.updated === 'string' && DATE_PATTERN.test(source.updated) ? source.updated : '',
    theme: oneOf(source.theme, THEMES),
    numbering: source.numbering === 'off' ? 'off' : 'on',
    pages
  };
}

/**
 * Adds what the views show about each page: its number (2.1.3), its chapter, and where its
 * figures start. In the paged view page 1 is the cover, so the first chapter is page 2.
 * @param {Manual} manual  a normalized manual
 * @returns {OutlineEntry[]}
 */
export function outline(manual) {
  /** @type {number[]} */
  const counters = [];
  /** @type {Page | null} */
  let chapter = null;
  let figuresInChapter = 0;
  let figuresInManual = 0;
  const isNumbered = manual.numbering === 'on';
  return manual.pages.map((page, index) => {
    counters.length = page.level + 1;
    counters[page.level] = (counters[page.level] || 0) + 1;
    if (page.level === 0) { chapter = page; figuresInChapter = 0; }
    const figureStart = isNumbered ? figuresInChapter : figuresInManual;
    const pictures = page.blocks.filter(block => block.type === 'picture').length;
    figuresInChapter += pictures;
    figuresInManual += pictures;
    return { page, index, pageNumber: index + 2, number: counters.map(count => count || 1).join('.'), chapter: chapter || page, figureStart };
  });
}

/**
 * @template T
 * @typedef {{ entry: T, children: TreeNode<T>[] }} TreeNode
 */

/**
 * Nests the flat list for drawing a tree.
 * @template {{ page?: { level: number }, level?: number }} T
 * @param {T[]} entries  items with a `page.level` (from outline()) or a `level` (pages)
 * @returns {TreeNode<T>[]}
 */
export function buildTree(entries) {
  /** @type {{ children: TreeNode<T>[] }} */
  const root = { children: [] };
  /** @type {{ level: number, node: { children: TreeNode<T>[] } }[]} */
  const stack = [{ level: -1, node: root }];
  for (const entry of entries) {
    const level = Number(entry.page ? entry.page.level : entry.level);
    while (stack[stack.length - 1].level >= level) stack.pop();
    const node = { entry, children: [] };
    stack[stack.length - 1].node.children.push(node);
    stack.push({ level, node });
  }
  return root.children;
}

/**
 * Where a page's group (the page and its sub-pages) ends.
 * @param {{ level: number }[]} pages
 * @param {number} index
 * @returns {number} the index just after the last sub-page
 */
export function groupEnd(pages, index) {
  let end = index + 1;
  while (end < pages.length && pages[end].level > pages[index].level) end++;
  return end;
}

/**
 * The index of the page before this one at the same level, or -1 when it is the first child.
 * @param {{ level: number }[]} pages
 * @param {number} index
 */
function previousSibling(pages, index) {
  for (let at = index - 1; at >= 0; at--) {
    if (pages[at].level === pages[index].level) return at;
    if (pages[at].level < pages[index].level) return -1;
  }
  return -1;
}

/**
 * Which moves make sense for a page, for enabling an editor's buttons.
 * @param {{ level: number }[]} pages
 * @param {number} index
 * @returns {{ up: boolean, down: boolean, in: boolean, out: boolean }}
 */
export function allowedMoves(pages, index) {
  const end = groupEnd(pages, index);
  const hasPrevious = previousSibling(pages, index) !== -1;
  const deepest = Math.max(...pages.slice(index, end).map(page => page.level));
  return {
    up: hasPrevious,
    down: end < pages.length && pages[end].level === pages[index].level,
    in: hasPrevious && deepest < MAX_LEVEL,
    out: pages[index].level > 0
  };
}

/**
 * Moves a page together with its sub-pages. Returns a new list; the old one is not changed.
 * @template {{ level: number }} P
 * @param {P[]} pages
 * @param {number} index
 * @param {'up'|'down'|'in'|'out'} direction  in: under the page above; out: up a level, after its parent's group
 * @returns {P[]}
 * @throws {Error} when the move is not allowed (check allowedMoves first)
 */
export function movePage(pages, index, direction) {
  if (!allowedMoves(pages, index)[direction]) throw new Error(`This page cannot move ${direction}`);
  const end = groupEnd(pages, index);
  const group = pages.slice(index, end);
  const rest = [...pages.slice(0, index), ...pages.slice(end)];
  if (direction === 'up') {
    const at = previousSibling(pages, index);
    return [...pages.slice(0, at), ...group, ...pages.slice(at, index), ...pages.slice(end)];
  }
  if (direction === 'down') {
    const nextEnd = groupEnd(pages, end);
    return [...pages.slice(0, index), ...pages.slice(end, nextEnd), ...group, ...pages.slice(nextEnd)];
  }
  if (direction === 'in') return [...pages.slice(0, index), ...group.map(page => ({ ...page, level: page.level + 1 })), ...pages.slice(end)];
  // out: find the parent in what is left, and put the group right after the parent's own group.
  let parent = index - 1;
  while (rest[parent].level >= pages[index].level) parent--;
  const insertAt = groupEnd(rest, parent);
  return [...rest.slice(0, insertAt), ...group.map(page => ({ ...page, level: page.level - 1 })), ...rest.slice(insertAt)];
}

/**
 * Adds a page. Returns the new list and where the page went.
 * @param {Page[]} pages
 * @param {number|null} index  the page to add next to, or null to add a chapter at the end
 * @param {boolean} [isChild]  true: as the last sub-page of that page; false: right after its group
 * @returns {{ pages: Page[], index: number }}
 */
export function addPage(pages, index, isChild = false) {
  const level = index === null ? 0 : Math.min(pages[index].level + (isChild ? 1 : 0), MAX_LEVEL);
  const at = index === null ? pages.length : groupEnd(pages, index);
  /** @type {Page} */
  const page = { id: newPageId(), title: 'New page', level, blocks: [{ type: 'paragraph', text: '' }] };
  return { pages: [...pages.slice(0, at), page, ...pages.slice(at)], index: at };
}

/**
 * Removes a page and its sub-pages.
 * @template {{ level: number }} P
 * @param {P[]} pages
 * @param {number} index
 * @returns {P[]}
 */
export function removePage(pages, index) {
  return [...pages.slice(0, index), ...pages.slice(groupEnd(pages, index))];
}

/**
 * A table typed as one row per line, cells split on "|". The first row is the header.
 * @param {string} value
 * @returns {string[][]}
 */
export function parseTableRows(value) {
  return text(value).split('\n').filter(line => line.trim()).map(line => line.split('|').map(cell => cell.trim()));
}

/**
 * A list typed as one item per line.
 * @param {string} value
 * @returns {string[]}
 */
export function parseListItems(value) {
  return text(value).split('\n').map(line => line.trim()).filter(Boolean);
}

/**
 * Shows a stored date the way people write it: 5 November 2026.
 * @param {string} isoDate  YYYY-MM-DD, or ''
 * @returns {string} '' when there is no date
 */
export function formatDate(isoDate) {
  if (!DATE_PATTERN.test(isoDate || '')) return '';
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
