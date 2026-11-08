/**
 * Search marks, shared by both readers: wrap matches in <mark data-search-mark>, and take them
 * out again. Built with DOM methods only, never innerHTML.
 */

/**
 * A pattern that finds `query` as plain text, ignoring case.
 * @param {string} query
 * @returns {RegExp}
 */
export function searchPattern(query) {
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
}

/**
 * Wraps every match of `pattern` in the text under `container` in <mark data-search-mark>.
 * @param {Element | null} container
 * @param {RegExp} pattern  a global pattern, from searchPattern()
 */
export function markMatches(container, pattern) {
  if (!container) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  /** @type {Text[]} */
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(/** @type {Text} */ (walker.currentNode));
  for (const node of textNodes) {
    const value = node.nodeValue || '';
    pattern.lastIndex = 0;
    if (!pattern.test(value)) continue;
    pattern.lastIndex = 0;
    const pieces = document.createDocumentFragment();
    let last = 0;
    for (const match of value.matchAll(pattern)) {
      const at = match.index ?? 0;
      if (at > last) pieces.append(value.slice(last, at));
      const mark = document.createElement('mark');
      mark.dataset.searchMark = '';
      mark.textContent = match[0];
      pieces.append(mark);
      last = at + match[0].length;
    }
    pieces.append(value.slice(last));
    node.parentNode?.replaceChild(pieces, node);
  }
}

/**
 * Takes every search mark under `root` out again, leaving the text as it was.
 * @param {ParentNode} root
 */
export function clearMarks(root) {
  for (const mark of root.querySelectorAll('mark[data-search-mark]')) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
    parent.normalize();
  }
}

/**
 * An element holding plain text.
 * @param {string} tag
 * @param {string} value
 * @returns {HTMLElement}
 */
export function textElement(tag, value) {
  const element = document.createElement(tag);
  element.textContent = value;
  return element;
}
