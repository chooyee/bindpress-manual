/**
 * Smoke test of the reader in a real browser (Chromium, through Playwright): both views under a
 * strict Content Security Policy, the narrow layouts, and the docs demo.
 *
 *   npx playwright install chromium   # once
 *   npm run test:browser
 *
 * Kept out of test/ so `npm test` stays fast and needs no browser.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

execFileSync(process.execPath, [fileURLToPath(new URL('../examples/server-render.mjs', import.meta.url))], { stdio: 'ignore' });
const server = await startServer(0);
const BASE = server.url;
const results = [];
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? `  (${detail})` : ''}`);
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const problems = [];
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) problems.push(message.text()); });
  page.on('pageerror', error => problems.push(error.message));
  const visibleQuestions = () => page.$$eval('details.x-man-qa', all => all.filter(details => details.offsetParent !== null));

  /* ---------- FAQ ---------- */
  await page.goto(`${BASE}/examples/output/faq.html`);
  await page.waitForSelector('.x-man-faq.is-reader');
  check('faq: the search and buttons appear', await page.isVisible('[data-faq-tools]'));
  check('faq: not clipped: the last topic is inside the FAQ', await page.evaluate(() => {
    const faq = document.querySelector('.x-man-faq').getBoundingClientRect();
    const last = [...document.querySelectorAll('[data-faq-topic]')].at(-1).getBoundingClientRect();
    return last.height > 0 && last.bottom <= faq.bottom;
  }));

  await page.fill('[data-faq-search]', 'password');
  await page.waitForFunction(() => document.querySelector('[data-faq-count]').textContent !== '');
  check('faq: search counts results', /result/.test(await page.textContent('[data-faq-count]')));
  check('faq: search hides what does not match', (await page.$$eval('details.x-man-qa', all => all.filter(d => d.offsetParent !== null).length)) === 1);
  check('faq: matching questions open', await page.$$eval('details.x-man-qa', all => all.filter(d => d.offsetParent !== null).every(d => d.open)));
  check('faq: matches are marked', (await page.$$eval('mark[data-search-mark]', all => all.length)) > 0);
  check('faq: a marked question stays one line', await page.$eval('#faq-account-forgot-password summary > span', span => span.getBoundingClientRect().height < 40));

  await page.fill('[data-faq-search]', 'zzzz');
  await page.waitForFunction(() => !document.querySelector('[data-faq-empty]').hidden);
  check('faq: says when nothing matches', /Nothing matches/.test(await page.textContent('[data-faq-empty]')));
  await page.press('[data-faq-search]', 'Escape');
  check('faq: Escape puts everything back, closed', await page.$$eval('details.x-man-qa', all => all.every(d => d.offsetParent !== null && !d.open)));
  check('faq: Escape removes the marks', (await page.$$eval('mark[data-search-mark]', all => all.length)) === 0);

  await page.click('[data-faq-action="expand"]');
  check('faq: Expand all', await page.$$eval('details.x-man-qa', all => all.every(d => d.open)));
  await page.click('[data-faq-action="collapse"]');
  check('faq: Collapse all', await page.$$eval('details.x-man-qa', all => all.every(d => !d.open)));

  await page.click('#faq-account-change-email summary');
  check('faq: opening a question puts its address in the address bar', page.url().endsWith('#faq-account-change-email'));
  await page.goto(`${BASE}/examples/output/faq.html#faq-payments-fees`);
  await page.waitForSelector('.x-man-faq.is-reader');
  check('faq: an address opens its answer', await page.$eval('#faq-payments-fees', d => d.open));

  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`${BASE}/examples/output/faq.html`);
  await page.waitForSelector('.x-man-faq.is-reader');
  check('faq, narrow: topics become a row of chips', (await page.$eval('.x-man-faq-nav > ol', el => getComputedStyle(el).display)) === 'flex');
  check('faq, narrow: no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  /* ---------- Manual ---------- */
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/examples/output/manual.html`);
  await page.waitForSelector('[data-manual].is-reader');
  check('manual: the toolbar appears', await page.isVisible('[data-manual-bar]'));
  check('manual: one sheet at a time', (await page.$$eval('.x-man-sheet', all => all.filter(s => s.offsetParent !== null).length)) === 1);
  await page.click('[data-action="next"]');
  check('manual: next page', (await page.inputValue('[data-page-input]')) === '2');
  await page.fill('[data-search]', 'deposit');
  await page.waitForFunction(() => / of /.test(document.querySelector('[data-search-count]').textContent));
  check('manual: search finds matches', true);
  await page.click('.x-man-tree a[data-page-link="4"]');
  check('manual: a contents link turns the page', (await page.inputValue('[data-page-input]')) === '4');

  await page.setViewportSize({ width: 390, height: 800 });
  await page.reload();
  await page.waitForSelector('[data-manual].is-reader');
  check('manual, narrow: contents start closed', await page.$eval('[data-manual]', el => el.classList.contains('is-nav-closed')));
  check('manual, narrow: no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  /* ---------- Docs demo ---------- */
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/docs/demo.html`);
  await page.waitForSelector('#output [data-faq].is-reader');
  await page.selectOption('#example', 'manual');
  await page.waitForSelector('#output [data-manual].is-reader');
  check('demo: switches example', true);
  await page.selectOption('#view', 'faq');
  await page.waitForSelector('#output [data-faq].is-reader');
  check('demo: the view setting applies', true);
  await page.fill('#json', '{"title": "T", "pages": [{"id": "a", "title": "A", "level": 2, "blocks": [{"type": "video"}]}]}');
  await page.waitForFunction(() => document.querySelector('#status').classList.contains('bad'));
  check('demo: shows what validateManual() found', /first page must be a chapter/.test(await page.textContent('#status')));

  check('no console errors or CSP violations', problems.length === 0, problems.slice(0, 5).join(' | '));
} finally {
  await browser.close();
  server.close();
}

console.log(results.join('\n'));
console.log(failed ? `\n${failed} failed` : `\nAll ${results.length} passed`);
process.exitCode = failed ? 1 : 0;
