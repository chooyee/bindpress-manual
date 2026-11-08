/**
 * npm run build → dist/: the classic-script bundle, for pages that load the package with a plain
 * <script src> instead of `import` (which also works from a page opened from disk).
 *
 *   dist/bindpress-manual.js       readable
 *   dist/bindpress-manual.min.js   minified, with a source map
 *   dist/manual.css                the stylesheet, minified
 *
 * Both scripts set one global, window.BindpressManual, holding everything the main entry and the
 * reader export. The source in src/ stays plain ES modules with no build step; this is only a
 * second way to load it.
 */
import { build as esbuild } from 'esbuild';
import { rm, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export const GLOBAL_NAME = 'BindpressManual';

/**
 * Builds the bundle.
 * @param {string} [outdir]  where to write it; dist/ in the repository when left out
 */
export async function build(outdir = fileURLToPath(new URL('../dist', import.meta.url))) {
  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const banner = `/*! @bindpress/manual ${version} | MIT License | https://github.com/chooyee/bindpress-manual */`;
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  // One entry with both halves, so a page needs a single <script>.
  const stdin = { contents: "export * from './index.js';\nexport * from './reader.js';\n", resolveDir: `${root}src`, sourcefile: 'global.js' };
  const shared = { stdin, bundle: true, format: /** @type {const} */ ('iife'), globalName: GLOBAL_NAME, target: 'es2020', banner: { js: banner }, logLevel: /** @type {const} */ ('warning') };
  await Promise.all([
    esbuild({ ...shared, outfile: `${outdir}/bindpress-manual.js` }),
    esbuild({ ...shared, outfile: `${outdir}/bindpress-manual.min.js`, minify: true, sourcemap: true }),
    esbuild({ entryPoints: [`${root}src/manual.css`], outfile: `${outdir}/manual.css`, minify: true, logLevel: 'warning' })
  ]);
}

// Run as a script (not imported by a test): build into dist/. Drive letters may differ in case on Windows.
if (process.argv[1] && pathToFileURL(process.argv[1]).href.toLowerCase() === import.meta.url.toLowerCase()) {
  await build();
  console.log('Wrote dist/bindpress-manual.js, dist/bindpress-manual.min.js and dist/manual.css');
}
