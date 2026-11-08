/**
 * The reader for the FAQ view (render-faq.js): search that filters the questions as you type,
 * Expand all / Collapse all, the topic you are reading marked in the list, and opening the
 * question an address points to. Started by startManualReaders() in reader.js.
 *
 * Search looks at each piece of content in a topic (a question with its answer, a paragraph, a
 * note, ...). Pieces that do not match are hidden, questions that match are opened, and a topic
 * whose title matches keeps all its content. Clearing the search puts everything back.
 */
import { searchPattern, markMatches, clearMarks } from './reader-search.js';

const SEARCH_DELAY_MS = 150;

/**
 * Turns one FAQ into the reader.
 * @param {HTMLElement} faq  the element with [data-faq]
 * @returns {() => void} stops the reader: removes its listeners on window
 */
export function startFaqReader(faq) {
  const tools = /** @type {HTMLElement | null} */ (faq.querySelector('[data-faq-tools]'));
  const searchInput = /** @type {HTMLInputElement} */ (faq.querySelector('[data-faq-search]'));
  const count = /** @type {HTMLElement} */ (faq.querySelector('[data-faq-count]'));
  const empty = /** @type {HTMLElement} */ (faq.querySelector('[data-faq-empty]'));
  if (!tools || !searchInput) return () => {};
  // Listeners on window outlive the FAQ; this removes them when the reader stops.
  const stopping = new AbortController();
  const { signal } = stopping;
  /** @type {IntersectionObserver | undefined} */
  let observer;
  const topics = /** @type {HTMLElement[]} */ ([...faq.querySelectorAll('[data-faq-topic]')]);
  const links = /** @type {HTMLElement[]} */ ([...faq.querySelectorAll('[data-faq-link]')]);
  const questions = /** @type {HTMLDetailsElement[]} */ ([...faq.querySelectorAll('details.x-man-qa')]);
  /** Questions the search opened, so clearing it can close them again. @type {Set<HTMLDetailsElement>} */
  const openedBySearch = new Set();
  /** @type {HTMLDetailsElement[]} */
  let closedForPrint = [];

  faq.classList.add('is-reader');
  tools.hidden = false;

  /** The pieces of content in a topic: everything but its title. @param {HTMLElement} topic */
  const piecesOf = (topic) => /** @type {HTMLElement[]} */ ([...topic.children].filter(child => !child.hasAttribute('data-faq-title')));
  /** @param {HTMLElement} topic */
  const linkOf = (topic) => links.find(link => link.dataset.faqLink === topic.id);

  /* ---------- search ---------- */
  function runSearch() {
    clearMarks(faq);
    const query = searchInput.value.trim();
    const isFiltering = query.length >= 2;
    faq.classList.toggle('is-filtering', isFiltering);
    if (!isFiltering) {
      for (const topic of topics) { topic.hidden = false; piecesOf(topic).forEach(piece => { piece.hidden = false; }); }
      for (const link of links) link.closest('li')?.removeAttribute('hidden');
      openedBySearch.forEach(details => { details.open = false; });
      openedBySearch.clear();
      count.textContent = '';
      empty.hidden = true;
      return;
    }
    const pattern = searchPattern(query);
    /** @param {Element} element */
    const matches = (element) => { pattern.lastIndex = 0; return pattern.test(element.textContent || ''); };
    let found = 0;
    for (const topic of topics) {
      const title = topic.querySelector('[data-faq-title]');
      const isTitleMatch = Boolean(title && matches(title));
      let isShown = isTitleMatch;
      for (const piece of piecesOf(topic)) {
        const isMatch = matches(piece);
        piece.hidden = !(isMatch || isTitleMatch);
        if (!isMatch) continue;
        isShown = true;
        found++;
        if (piece instanceof HTMLDetailsElement && !piece.open) { piece.open = true; openedBySearch.add(piece); }
        markMatches(piece, pattern);
      }
      if (title && isTitleMatch) markMatches(title, pattern);
      topic.hidden = !isShown;
    }
    // Sub-topics come after their topic, so walk the list backwards: a topic stays listed while
    // any of its sub-topics is.
    for (const topic of [...topics].reverse()) {
      const item = linkOf(topic)?.closest('li');
      if (item) item.hidden = topic.hidden && !item.querySelector('li:not([hidden])');
    }
    count.textContent = found ? `${found} ${found === 1 ? 'result' : 'results'}` : '';
    empty.hidden = topics.some(topic => !topic.hidden);
    empty.textContent = `Nothing matches “${query}”. Check the spelling, or try a shorter word.`;
  }

  /* ---------- the topic in view, and addresses ---------- */
  /** @param {string} topicId */
  function markTopic(topicId) {
    for (const link of links) {
      if (link.dataset.faqLink === topicId) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  if ('IntersectionObserver' in window) {
    // A topic counts as "in view" once its top passes the upper third of the window.
    const watcher = new IntersectionObserver((records) => {
      const visible = records.filter(record => record.isIntersecting).map(record => /** @type {HTMLElement} */ (record.target));
      if (visible.length) markTopic(visible[0].id);
    }, { rootMargin: '0px 0px -66% 0px' });
    topics.forEach(topic => watcher.observe(topic));
    observer = watcher;
  }

  function openFromAddress() {
    if (!location.hash) return;
    let target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
    if (!target || !faq.contains(target)) return;
    if (target instanceof HTMLDetailsElement) target.open = true;
    target.scrollIntoView({ block: 'start' });
  }

  /* ---------- wiring ---------- */
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let searchTimer;
  searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, SEARCH_DELAY_MS); });
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { searchInput.value = ''; runSearch(); }
  });
  tools.addEventListener('click', (event) => {
    const button = /** @type {HTMLElement | null} */ (/** @type {Element} */ (event.target).closest('[data-faq-action]'));
    if (!button) return;
    const isOpen = button.dataset.faqAction === 'expand';
    questions.filter(details => !details.hidden).forEach(details => { details.open = isOpen; });
    openedBySearch.clear();
  });
  faq.addEventListener('click', (event) => {
    // Opening a question by hand gives the page its address, so it can be copied and shared.
    const summary = /** @type {Element} */ (event.target).closest('summary');
    const details = summary?.parentElement;
    if (details instanceof HTMLDetailsElement && details.id && !details.open) history.replaceState(null, '', `#${details.id}`);
    if (details instanceof HTMLDetailsElement) openedBySearch.delete(details);
  });
  faq.addEventListener('keydown', (event) => {
    if (event.key === '/' && !/** @type {Element} */ (event.target).matches('input, textarea, select')) { event.preventDefault(); searchInput.focus(); }
  });
  window.addEventListener('hashchange', openFromAddress, { signal });
  window.addEventListener('beforeprint', () => {
    closedForPrint = questions.filter(details => !details.open);
    closedForPrint.forEach(details => { details.open = true; });
  }, { signal });
  window.addEventListener('afterprint', () => { closedForPrint.forEach(details => { details.open = false; }); }, { signal });

  openFromAddress();
  return () => {
    stopping.abort();
    observer?.disconnect();
  };
}
