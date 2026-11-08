/**
 * The two helpers that make author text safe to put in HTML. Every value from a manual goes
 * through esc(), and every picture address through safeUrl(), before it reaches the markup.
 */

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * Escapes a value for use in HTML text or in a quoted attribute.
 * @param {unknown} value
 * @returns {string}
 */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ENTITIES[/** @type {keyof typeof ENTITIES} */ (character)]);
}

/**
 * Checks an address before it goes in `href` or `src`. Relative addresses and http(s) pass; for
 * pictures, `data:image/...` passes too. Anything else (javascript:, vbscript:, data:text/html, ...)
 * is refused.
 * @param {unknown} url
 * @param {boolean} [isImage]  true for an <img src>
 * @returns {string} the address, or '' for a refused picture and '#' for a refused link
 */
export function safeUrl(url, isImage = false) {
  // Browsers ignore control characters and spaces inside a scheme ("java\tscript:"), so drop them first.
  const value = String(url || '').replace(/[\x00-\x20]/g, '');
  if (isImage && /^data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]/i.test(value)) return value;
  const scheme = /^[a-z][a-z0-9+.-]*:/i.exec(value);
  if (!scheme || /^https?:$/i.test(scheme[0]) || (!isImage && /^mailto:$/i.test(scheme[0]))) return value;
  return isImage ? '' : '#';
}
