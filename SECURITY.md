# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

Before 1.0, only the latest minor version gets security fixes.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately through [GitHub security advisories](https://github.com/chooyee/bindpress-manual/security/advisories/new). Include:

- what the problem is and what an attacker could do with it,
- the manual JSON (or steps) that reproduce it,
- the @bindpress/manual version and browser.

We aim to reply within 3 working days and to ship a fix, or a plan, within 30 days. We will credit you in the release notes unless you prefer not to be named.

## Scope

The most relevant problems are:
- ways for manual JSON to run script, load unexpected content or add attributes when rendered by `renderManual()` or `faqJsonLd()`,
- ways around `esc()` or `safeUrl()`,
- ways for the reader to run page content as script, or to need a weaker Content Security Policy than the one in [docs/api.html](docs/api.html#security).

The renderer assumes the HTML is placed in an HTML context as it is. Changing its output before inserting it is out of scope.
