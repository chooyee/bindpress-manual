/**
 * @bindpress/manual/reader: the browser part. Load it on a page that shows renderManual() HTML:
 *
 *   import { startManualReaders } from '@bindpress/manual/reader';
 *   startManualReaders();
 *
 * A manual becomes the PDF-style reader (paged-reader.js), an FAQ gets search and Expand all
 * (faq-reader.js). Without this script both still read well: the HTML never depends on it.
 * It only adds behaviour and builds a few elements with DOM methods; it never sets innerHTML,
 * so it runs under a strict Content Security Policy.
 */
import { startPagedReader } from './paged-reader.js';
import { startFaqReader } from './faq-reader.js';

export { startPagedReader, startFaqReader };

/** How to stop each running reader, by its element. @type {WeakMap<HTMLElement, () => void>} */
const running = new WeakMap();

/**
 * Starts every manual and FAQ under `root` that is not running yet. Safe to call again after
 * adding more to the page.
 * @param {ParentNode} [root]
 * @returns {number} how many readers were started
 */
export function startManualReaders(root = document) {
  const manuals = /** @type {HTMLElement[]} */ ([...root.querySelectorAll('[data-manual]:not(.is-reader)')]);
  const faqs = /** @type {HTMLElement[]} */ ([...root.querySelectorAll('[data-faq]:not(.is-reader)')]);
  for (const manual of manuals) running.set(manual, startPagedReader(manual));
  for (const faq of faqs) running.set(faq, startFaqReader(faq));
  return manuals.length + faqs.length;
}

/**
 * Stops the readers under `root` (and `root` itself, if it is one), removing their listeners on
 * window and document. Call it before you remove or replace a manual's HTML, as a single-page
 * app does on leaving a page.
 * @param {ParentNode} [root]
 * @returns {number} how many readers were stopped
 */
export function stopManualReaders(root = document) {
  const elements = /** @type {HTMLElement[]} */ ([...root.querySelectorAll('.is-reader')]);
  if (root instanceof HTMLElement && root.classList.contains('is-reader')) elements.push(root);
  let stopped = 0;
  for (const element of elements) {
    const stop = running.get(element);
    if (!stop) continue;
    stop();
    running.delete(element);
    stopped++;
  }
  return stopped;
}
