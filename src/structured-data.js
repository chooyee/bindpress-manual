/**
 * schema.org FAQPage data for an FAQ, so search engines can show its questions and answers.
 * Opt-in: renderManual() never adds it, because only the page owner knows whether this FAQ is
 * the page's main content (search engines expect one FAQPage per page).
 */
import { normalizeManual } from './model.js';

/**
 * The FAQPage JSON-LD for a manual's questions, ready to put inside
 * `<script type="application/ld+json">…</script>`. "<", ">", "&" and line separators are written
 * as \u escapes, so no answer can close the script element.
 * @param {unknown} manual  the manual JSON
 * @returns {string} JSON text, or '' when the manual has no questions
 */
export function faqJsonLd(manual) {
  const clean = normalizeManual(manual);
  const questions = clean.pages.flatMap(page => page.blocks)
    .filter(block => block.type === 'question' && block.question?.trim() && block.text.trim())
    .map(block => ({ '@type': 'Question', name: block.question, acceptedAnswer: { '@type': 'Answer', text: block.text } }));
  if (!questions.length) return '';
  const json = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: questions });
  return json.replace(/[<>&\u{2028}\u{2029}]/gu, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
