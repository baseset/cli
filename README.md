# BaseSet CLI

> [!WARNING]
> **Work in progress:** BaseSet CLI is an early prototype. Its commands, output,
> schemas, and inference behaviour may change without notice.

BaseSet discovers implicit standards, conventions, and inconsistencies already
present in an organisation's software.

The CLI currently scans a local Git repository, extracts provenance-aware UI
text observations, and identifies candidate heading-case conventions. A
candidate convention is evidence of an apparent pattern—not an accepted
standard, rule, violation, or recommendation.

## Current capabilities

- Finds the repository root and respects `.gitignore`.
- Scans `.ts`, `.tsx`, `.js`, `.jsx`, and `.vue` files.
- Extracts user-facing JSX and Vue template text.
- Preserves file, line, column, and element provenance.
- Groups related text fragments into rendered heading text units.
- Classifies native headings as sentence case, title case, uppercase,
  lowercase, or unknown.
- Produces deterministic candidate conventions when evidence is sufficient.
- Generates a self-contained HTML findings report.

## Local development

Requires Node.js 20 or newer.

```sh
npm install
npm test
npm run typecheck
npm run build
```

Link the development build to make the `baseset` command available locally:

```sh
npm link
```

Re-run `npm run build` after changing the source.

## Usage

Run a scan from anywhere inside the Git repository you want to inspect:

```sh
baseset scan
```

Generate an HTML report at `.baseset/report.html`:

```sh
baseset scan --output
```

Write the report to a custom path:

```sh
baseset scan --output ./reports/baseset.html
```

Inspect the complete machine-readable scan result:

```sh
baseset scan --json
```

## Project boundary

BaseSet currently performs local, deterministic discovery and inference. It
does not establish organisational standards, report violations, recommend or
apply fixes, inspect Git history, use an LLM, or send repository contents to a
cloud service.

See [PRODUCT.md](./PRODUCT.md) for the wider product direction.
