// The live demo: render the JSON in the textarea, with the settings from the controls.
import { renderManual, validateManual } from '../src/index.js';
import { startManualReaders, stopManualReaders } from '../src/reader.js';

const RENDER_DELAY_MS = 300;
const byId = (id) => document.getElementById(id);
const output = byId('output');
const editor = byId('json');
const status = byId('status');
const controls = ['example', 'view', 'theme', 'numbering'].map(byId);
/** @type {Record<string, object>} */
const examples = {};

async function loadExample(name) {
  if (!examples[name]) examples[name] = await (await fetch(`../examples/${name}.json`)).json();
  editor.value = JSON.stringify(examples[name], null, 2);
  render();
}

function showStatus(problems) {
  status.replaceChildren();
  status.className = `demo-status ${problems.length ? 'bad' : 'ok'}`;
  if (!problems.length) { status.textContent = 'Valid: validateManual() found no mistakes.'; return; }
  status.append(problems.length === 1 ? '1 mistake (the manual still renders, cleaned):' : `${problems.length} mistakes (the manual still renders, cleaned):`);
  const list = document.createElement('ul');
  for (const problem of problems.slice(0, 8)) {
    const item = document.createElement('li');
    item.textContent = problem;
    list.append(item);
  }
  status.append(list);
}

function render() {
  let manual;
  try {
    manual = JSON.parse(editor.value);
  } catch (error) {
    showStatus([`This is not valid JSON: ${error.message}`]);
    return;
  }
  const { errors } = validateManual(manual);
  showStatus(errors.map(error => `${error.path || '(the manual)'}: ${error.message}`));
  const [, view, theme, numbering] = controls.map(control => control.value);
  const settings = manual && typeof manual === 'object' && !Array.isArray(manual)
    ? { ...manual, ...(theme && { theme }), ...(numbering && { numbering }) } : manual;
  // renderManual() escapes every value, so its HTML is safe to insert, even from the textarea.
  stopManualReaders(output);
  output.innerHTML = renderManual(settings, { id: 'demo', view });
  startManualReaders(output);
}

let timer;
editor.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, RENDER_DELAY_MS); });
controls[0].addEventListener('change', () => loadExample(controls[0].value));
controls.slice(1).forEach(control => control.addEventListener('change', render));
loadExample(controls[0].value);
