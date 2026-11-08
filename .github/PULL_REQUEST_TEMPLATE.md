## What and why

<!-- What does this change, and why? Link the issue: "Fixes #123" -->

## Checklist

- [ ] `npm test`, `npm run typecheck` and `npm run test:browser` pass
- [ ] Tried in the demo on a wide and a narrow screen
- [ ] Rendering escapes values (`esc`), checks and escapes picture addresses (`safeUrl`), and the reader uses no `innerHTML`
- [ ] Format changes are additive, and update `normalizeManual`, `validateManual`, the schema and `docs/format.html` together
- [ ] Docs (`docs/`) updated if the format or API changed
- [ ] Line added under **Unreleased** in `CHANGELOG.md`
- [ ] Screenshot attached for visual changes
