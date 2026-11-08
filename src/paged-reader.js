/**
 * The reader for the paged view (render-paged.js): one sheet at a time, a contents tree that
 * folds, search with highlighted matches, page numbers, zoom, full screen and print.
 * Started by startManualReaders() in reader.js.
 */
import { searchPattern, markMatches, clearMarks, textElement } from './reader-search.js';

const SEARCH_DELAY_MS = 200;
const NARROW_PX = 760;

/**
 * Turns one paged manual into the reader.
 * @param {HTMLElement} manual  the element with [data-manual]
 * @returns {() => void} stops the reader: removes its listeners on window and document
 */
export function startPagedReader(manual) {
  /** @template {Element} T @param {string} selector @returns {T} */
  const find = (selector) => /** @type {T} */ (manual.querySelector(selector));
  /** @type {HTMLElement} */ const bar = find('[data-manual-bar]');
  /** @type {HTMLElement} */ const viewport = find('[data-manual-viewport]');
  /** @type {HTMLElement} */ const nav = find('[data-manual-nav]');
  /** @type {HTMLElement} */ const results = find('[data-search-results]');
  /** @type {HTMLInputElement} */ const searchInput = find('[data-search]');
  /** @type {HTMLElement} */ const searchCount = find('[data-search-count]');
  /** @type {HTMLInputElement} */ const pageInput = find('[data-page-input]');
  /** @type {HTMLElement} */ const zoomLabel = find('[data-zoom-label]');
  if (!bar || !viewport || !nav || !searchInput || !pageInput) return () => {};
  // Listeners on window and document outlive the manual; this removes them when the reader stops.
  const stopping = new AbortController();
  const { signal } = stopping;
  const sheets = /** @type {HTMLElement[]} */ ([...manual.querySelectorAll('.x-man-sheet')]);
  /** @param {string} name @returns {HTMLButtonElement} */
  const action = (name) => find(`[data-action="${name}"]`);
  /** @type {{ index: number, zoom: number, matches: HTMLElement[], matchIndex: number, closedForPrint: HTMLDetailsElement[] }} */
  const state = { index: 0, zoom: 1, matches: [], matchIndex: -1, closedForPrint: [] };
  /** @param {Element | null} element */
  const sheetOf = (element) => sheets.indexOf(/** @type {HTMLElement} */ (element?.closest('.x-man-sheet')));

  manual.classList.add('is-reader');
  bar.hidden = false;
  viewport.tabIndex = -1; // a click inside the sheet focuses the reader, so the arrow keys work
  if (manual.clientWidth < NARROW_PX) manual.classList.add('is-nav-closed');
  addFoldButtons(nav);

  /** @param {number} index @param {{ keepScroll?: boolean, updateAddress?: boolean }} [options] */
  function showSheet(index, { keepScroll = false, updateAddress = true } = {}) {
    state.index = Math.max(0, Math.min(index, sheets.length - 1));
    sheets.forEach((sheet, at) => sheet.classList.toggle('is-current', at === state.index));
    const pageNumber = state.index + 1;
    if (document.activeElement !== pageInput) pageInput.value = String(pageNumber);
    action('previous').disabled = state.index === 0;
    action('next').disabled = state.index === sheets.length - 1;
    for (const link of /** @type {NodeListOf<HTMLElement>} */ (nav.querySelectorAll('[data-page-link]'))) {
      const isHere = Number(link.dataset.pageLink) === pageNumber;
      if (isHere) {
        link.setAttribute('aria-current', 'page');
        for (let item = link.closest('li')?.parentElement?.closest('li'); item; item = item.parentElement?.closest('li')) unfold(item);
        link.scrollIntoView({ block: 'nearest' });
      } else link.removeAttribute('aria-current');
    }
    if (!keepScroll) viewport.scrollTop = 0;
    if (updateAddress) history.replaceState(null, '', `#${sheets[state.index].id}`);
  }

  /** @param {HTMLElement} link @param {Event} event */
  function goToLink(link, event) {
    event.preventDefault();
    showSheet(Number(link.dataset.pageLink) - 1);
    if (manual.clientWidth < NARROW_PX) manual.classList.add('is-nav-closed');
  }

  /* ---------- search ---------- */
  function runSearch() {
    clearMarks(manual);
    state.matches = [];
    state.matchIndex = -1;
    const query = searchInput.value.trim();
    if (query.length >= 2) {
      const pattern = searchPattern(query);
      sheets.forEach(sheet => markMatches(sheet.querySelector('.x-man-sheet-body'), pattern));
      state.matches = /** @type {HTMLElement[]} */ ([...manual.querySelectorAll('mark[data-search-mark]')]);
    }
    drawResults(query);
    const firstFromHere = state.matches.findIndex(mark => sheetOf(mark) >= state.index);
    if (state.matches.length) goToMatch(Math.max(firstFromHere, 0));
    else drawCount(query);
  }

  /** @param {number} index */
  function goToMatch(index) {
    if (!state.matches.length) return;
    state.matches[state.matchIndex]?.classList.remove('is-current');
    state.matchIndex = (index + state.matches.length) % state.matches.length;
    const mark = state.matches[state.matchIndex];
    mark.classList.add('is-current');
    const details = mark.closest('details');
    if (details) details.open = true;
    showSheet(sheetOf(mark));
    mark.scrollIntoView({ block: 'center' });
    drawCount(searchInput.value.trim());
    for (const row of /** @type {NodeListOf<HTMLElement>} */ (results.querySelectorAll('.x-man-result'))) row.setAttribute('aria-current', String(Number(row.dataset.sheet) === state.index));
  }

  /** @param {string} query */
  function drawCount(query) {
    searchCount.textContent = query.length < 2 ? '' : (state.matches.length ? `${state.matchIndex + 1} of ${state.matches.length}` : 'No matches');
    action('match-previous').disabled = action('match-next').disabled = state.matches.length === 0;
  }

  /** One row per sheet that has matches, above the contents tree. @param {string} query */
  function drawResults(query) {
    results.replaceChildren();
    results.hidden = query.length < 2;
    if (results.hidden) return;
    /** @type {Map<number, number>} */
    const counts = new Map();
    for (const mark of state.matches) {
      const at = sheetOf(mark);
      counts.set(at, (counts.get(at) || 0) + 1);
    }
    if (!counts.size) { results.append(textElement('p', `No pages contain “${query}”. Check the spelling, or try a shorter word.`)); return; }
    for (const [at, count] of counts) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'x-man-result';
      row.dataset.sheet = String(at);
      const title = sheets[at].querySelector('h1, h2')?.textContent || `Page ${at + 1}`;
      row.append(textElement('span', title), textElement('small', `Page ${at + 1} · ${count === 1 ? '1 match' : `${count} matches`}`));
      row.addEventListener('click', () => goToMatch(state.matches.findIndex(mark => sheetOf(mark) === at)));
      results.append(row);
    }
  }

  /* ---------- full screen, zoom, pictures, print ---------- */
  /** @param {boolean} isOn */
  function markFullScreen(isOn) {
    manual.classList.toggle('is-focus', isOn);
    document.documentElement.style.overflow = isOn ? 'hidden' : '';
    const label = isOn ? 'Exit full screen' : 'Full screen';
    action('full').title = label;
    action('full').setAttribute('aria-label', label);
  }

  async function toggleFullScreen() {
    const isOn = !manual.classList.contains('is-focus');
    markFullScreen(isOn);
    try {
      if (isOn && manual.requestFullscreen) await manual.requestFullscreen();
      else if (!isOn && document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // Phones (iPhone Safari) refuse real full screen; the reader still fills the window.
    }
  }

  /** @param {number} zoom */
  function setZoom(zoom) {
    state.zoom = Math.round(Math.min(Math.max(zoom, 0.6), 1.6) * 10) / 10;
    manual.style.setProperty('--man-zoom', String(state.zoom));
    zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  /** @param {HTMLImageElement} image */
  function openPicture(image) {
    const box = document.createElement('button');
    box.type = 'button';
    box.className = 'x-man-lightbox';
    box.setAttribute('aria-label', 'Close picture');
    const large = document.createElement('img');
    large.src = image.src;
    large.alt = image.alt;
    box.append(large, textElement('span', `${image.closest('figure')?.querySelector('figcaption')?.textContent || ''} · Tap to close`));
    box.addEventListener('click', () => box.remove());
    manual.querySelector('.x-man-body')?.append(box);
    box.focus();
  }

  /* ---------- wiring ---------- */
  /** @type {Record<string, () => void>} */
  const handlers = {
    contents: () => manual.classList.toggle('is-nav-closed'),
    search: () => { manual.classList.toggle('is-search-open'); if (manual.classList.contains('is-search-open')) searchInput.focus(); },
    'match-previous': () => goToMatch(state.matchIndex - 1),
    'match-next': () => goToMatch(state.matchIndex + 1),
    previous: () => showSheet(state.index - 1),
    next: () => showSheet(state.index + 1),
    'zoom-out': () => setZoom(state.zoom - 0.1),
    'zoom-in': () => setZoom(state.zoom + 0.1),
    full: toggleFullScreen,
    print: () => window.print()
  };
  bar.addEventListener('click', (event) => {
    const button = /** @type {HTMLElement | null} */ (/** @type {Element} */ (event.target).closest('[data-action]'));
    const name = button?.dataset.action;
    if (name && handlers[name]) handlers[name]();
  });
  manual.addEventListener('click', (event) => {
    const target = /** @type {Element} */ (event.target);
    const link = /** @type {HTMLElement | null} */ (target.closest('a[data-page-link]'));
    if (link) return goToLink(link, event);
    const image = /** @type {HTMLImageElement | null} */ (target.closest('.x-man-figure img'));
    if (image) openPicture(image);
  });
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let searchTimer;
  searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, SEARCH_DELAY_MS); });
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); goToMatch(state.matchIndex + (event.shiftKey ? -1 : 1)); }
    if (event.key === 'Escape') { searchInput.value = ''; runSearch(); }
  });
  pageInput.addEventListener('focus', () => pageInput.select());
  pageInput.addEventListener('change', () => showSheet((Number(pageInput.value) || 1) - 1));
  manual.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      manual.querySelector('.x-man-lightbox')?.remove();
      if (manual.classList.contains('is-focus') && !document.fullscreenElement) toggleFullScreen();
      return;
    }
    if (/** @type {Element} */ (event.target).matches('input, textarea, select')) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); showSheet(state.index + 1); }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); showSheet(state.index - 1); }
    if (event.key === '/') { event.preventDefault(); manual.classList.add('is-search-open'); searchInput.focus(); }
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && manual.classList.contains('is-focus')) markFullScreen(false);
  }, { signal });
  addSwipe(viewport, (step) => showSheet(state.index + step));
  // Printing gives every sheet; closed questions are opened for it and closed again afterwards.
  window.addEventListener('beforeprint', () => {
    state.closedForPrint = [...manual.querySelectorAll('details:not([open])')].map(details => /** @type {HTMLDetailsElement} */ (details));
    state.closedForPrint.forEach(details => { details.open = true; });
  }, { signal });
  window.addEventListener('afterprint', () => state.closedForPrint.forEach(details => { details.open = false; }), { signal });
  window.addEventListener('hashchange', () => {
    const at = sheets.findIndex(sheet => `#${sheet.id}` === location.hash);
    if (at >= 0) showSheet(at, { updateAddress: false });
  }, { signal });

  const fromAddress = sheets.findIndex(sheet => `#${sheet.id}` === location.hash);
  setZoom(1);
  drawCount('');
  showSheet(Math.max(fromAddress, 0), { updateAddress: fromAddress >= 0 });
  return () => {
    stopping.abort();
    if (manual.classList.contains('is-focus')) markFullScreen(false);
  };
}

/** Puts a fold button before each tree link that has sub-pages. @param {HTMLElement} nav */
function addFoldButtons(nav) {
  for (const item of nav.querySelectorAll('.x-man-tree li')) {
    const link = item.querySelector(':scope > a');
    if (!link) continue;
    const row = document.createElement('div');
    row.className = 'x-man-tree-row';
    item.insertBefore(row, link);
    if (item.querySelector(':scope > ol')) {
      const fold = document.createElement('button');
      fold.type = 'button';
      fold.className = 'x-man-fold';
      fold.setAttribute('aria-label', `Fold ${link.textContent}`);
      fold.setAttribute('aria-expanded', 'true');
      fold.addEventListener('click', () => (item.classList.contains('is-folded') ? unfold(item) : foldItem(item)));
      row.append(fold);
    } else {
      const gap = document.createElement('span');
      gap.className = 'x-man-fold-gap';
      row.append(gap);
    }
    row.append(link);
  }
}
/** @param {Element} item */
function foldItem(item) {
  item.classList.add('is-folded');
  item.querySelector(':scope > .x-man-tree-row .x-man-fold')?.setAttribute('aria-expanded', 'false');
}
/** @param {Element} item */
function unfold(item) {
  item.classList.remove('is-folded');
  item.querySelector(':scope > .x-man-tree-row .x-man-fold')?.setAttribute('aria-expanded', 'true');
}

/**
 * A sideways swipe turns the page. Swipes that start in a wide table scroll the table instead.
 * @param {HTMLElement} target
 * @param {(step: number) => void} turn
 */
function addSwipe(target, turn) {
  let startX = 0;
  let startY = 0;
  let isTracking = false;
  target.addEventListener('touchstart', (event) => {
    isTracking = event.touches.length === 1 && !/** @type {Element} */ (event.target).closest('.x-man-table');
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  }, { passive: true });
  target.addEventListener('touchend', (event) => {
    if (!isTracking) return;
    const deltaX = event.changedTouches[0].clientX - startX;
    const deltaY = event.changedTouches[0].clientY - startY;
    if (Math.abs(deltaX) > 70 && Math.abs(deltaX) > Math.abs(deltaY) * 1.6) turn(deltaX < 0 ? 1 : -1);
  }, { passive: true });
}
