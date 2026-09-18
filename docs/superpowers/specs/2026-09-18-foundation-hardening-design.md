# Electrical Calculator Foundation Hardening Design

## Purpose

Improve the calculator's development reliability, formula regression coverage, browser storage consistency, input safety, and schematic maintainability without changing its defining runtime constraints: the published application remains a static site, works offline, and can be opened directly from `index.html` without a server, package installation, or build step.

## Scope

This work covers five related improvements:

1. Make the Playwright-based test environment reproducible.
2. Add golden regression cases for high-risk engineering calculations.
3. Split the oversized schematic implementation along stable responsibility boundaries.
4. Introduce a shared browser-storage facade while preserving existing data.
5. Harden imported data, image data, and user-controlled HTML output.

It does not add a backend, user accounts, cloud synchronization, a runtime framework, a bundler, or a mandatory local web server. It does not intentionally change engineering formulas, report layouts, saved-project formats, published URLs, or the Cloudflare Pages deployment model.

## Current State

- The application is assembled by ordered classic scripts in `index.html` and registers calculators through `window.ElectricalToolkit`.
- Runtime state is stored in `localStorage` and IndexedDB. Several calculators also manage their own storage keys directly.
- The project contains fourteen `.cjs` test scripts. Three pure Node.js tests run without external packages; eleven browser-oriented tests currently stop at startup because `playwright` is unavailable. DFMEA and DVP&R browser tests also require the Node.js `jszip` package.
- The global npm launcher on the current workstation is broken, but Corepack is available. Repository tooling therefore needs a package-manager declaration rather than relying on an unrecorded global installation.
- `js/calc-schematic.js` is approximately 146 KB and combines state normalization, geometry, routing, SVG output, interaction handling, persistence, import/export, and UI composition.
- The application uses `innerHTML` extensively. Much of it is static UI markup, but imported or user-authored values require consistent escaping and validation.
- `代码审查与架构说明.md` describes an older application version and no longer reflects the full module, storage, or test architecture.

## Chosen Approach

Use an incremental compatibility-preserving refactor. Establish executable regression protection first, then introduce shared infrastructure, and only then extract schematic responsibilities one boundary at a time.

This approach is preferred over a full rewrite because the calculator contains mature engineering behavior, report generation, browser persistence, and local-file workflows that are expensive to reproduce exactly. It is preferred over a dependency-only patch because installing Playwright alone would leave the main maintainability and data-safety risks unchanged.

## Runtime and Development Boundaries

### Published runtime

- Continue loading plain HTML, CSS, and classic JavaScript files.
- Do not publish `node_modules`, test reports, or package-manager caches.
- Do not require an HTTP server for normal use or automated browser tests unless a specific browser limitation makes a test impossible under `file://`.
- Do not introduce network requests into calculator operation.
- Keep `Electrical_Calculator.html` as the compatibility redirect and `index.html` as the canonical entry point.

### Development tooling

- Add a root `package.json` with test-only scripts and dependencies.
- Use Corepack-managed pnpm on the current workstation and commit its lockfile for reproducibility.
- Declare `playwright` and `jszip` as development dependencies.
- Install only Chromium because every existing browser test imports Playwright's Chromium launcher.
- Add `node_modules/`, Playwright reports, test results, and temporary test artifacts to `.gitignore`.
- Provide one cross-platform Node.js test runner that discovers the repository's `.cjs` tests, runs them in deterministic groups, forwards exit codes, and prints a concise summary.

The package manifest supports development only. It must not add build or deployment steps to Cloudflare Pages.

## Test Architecture

### Test groups

The unified runner exposes three groups:

- `test:syntax`: run `node --check` over first-party JavaScript and test files, excluding vendored minified libraries.
- `test:unit`: run tests that do not launch a browser.
- `test:browser`: run tests that use Playwright and Chromium.
- `test`: run all three groups in that order and stop on the first failing group.

Tests must not depend on a developer-specific absolute module path. The existing `PLAYWRIGHT_MODULE` escape hatch may remain for compatibility, but the repository-local dependency is the default.

### Golden formula cases

Add versioned fixture data for the highest-risk calculators:

- relay and fuse coordination;
- conductor resistance and voltage drop;
- precharge sizing;
- RMS current, wire sizing, and busbar temperature;
- IEC 60664 insulation checks;
- bolt-joint verification;
- tolerance stack calculations.

Each covered calculator receives at least:

- one nominal engineering case;
- one boundary case at or near a pass/fail threshold;
- one invalid or incomplete-input case;
- one unit-conversion or formatting case where the module supports multiple representations.

Expected numeric outputs are stored with an explicit tolerance rather than compared as formatted strings. Expected statuses and validation messages are compared semantically. Fixture provenance records whether a value comes from an existing formula, a standard table already bundled with the project, or a previously verified sample.

The first regression tests exercise the real browser UI to protect end-to-end behavior. Pure calculation kernels may be extracted later only when doing so reduces coupling without changing results.

## Shared Storage Design

Create a classic-script-compatible `window.ElectricalStorage` facade loaded before `app.js` and calculator modules. Its public surface provides:

- safe JSON read, write, and remove operations for localStorage;
- IndexedDB-backed large-payload storage for images and attachments;
- structured results that distinguish unavailable storage, quota exhaustion, malformed data, and migration failure;
- schema-version metadata and registered per-record migrations;
- import validation helpers and backup-friendly serialization;
- a legacy-key lookup path.

Migration is lazy and non-destructive:

1. Read the current key.
2. If absent, try the known legacy key or format.
3. Validate and normalize the data in memory.
4. Write the current representation only after successful validation.
5. Retain the legacy value until the new write succeeds.

The first consumers are the shared draft service, material overrides, part-estimator projects, and IEC 60664 system state. Existing public calculator draft methods (`captureDraft`, `restoreDraft`, and `resetDraft`) remain compatible.

Failures are visible to users. A quota or persistence error must keep the in-memory work intact and show a recommendation to export JSON rather than silently discarding changes.

## Input and Output Safety

Add a shared `window.ElectricalSafety` utility loaded before feature modules. It provides narrowly scoped helpers instead of a general-purpose HTML sanitizer:

- escape text and attribute values;
- assign text with DOM APIs;
- validate plain-object and array shapes;
- constrain imported JSON by byte size, nesting depth, collection length, and expected field type;
- accept image data only from an explicit MIME allowlist and within a configurable decoded-size limit;
- normalize filenames used by downloads and document titles;
- reject dangerous URL schemes where imported values can become links or image sources.

Static trusted templates may continue using `innerHTML`. Any interpolation derived from form fields, imported JSON, editable libraries, filenames, titles, notes, component names, pin definitions, or attachment metadata must use escaping or DOM assignment before reaching HTML.

A strict Content Security Policy is deferred because the current app intentionally uses inline module styles, classic scripts, blob downloads, data images, and local-file execution. Introducing CSP without first removing those dependencies would break supported workflows.

## Schematic Decomposition

Create ordered classic scripts under `js/schematic/` that cooperate through one internal namespace. The target responsibilities are:

- `model.js`: defaults, normalization, IDs, schema versions, and legacy project migration;
- `geometry.js`: component bounds, pin locations, collision checks, and coordinate transforms;
- `routing.js`: orthogonal paths, waypoints, junction binding, crossings, and wire-label placement;
- `svg.js`: deterministic SVG markup and print/export rendering;
- `io.js`: JSON import/export, SVG download, image handling, and print preparation;
- `interactions.js`: pointer, keyboard, selection, drag, resize, pan, and zoom behavior;
- `calc-schematic.js`: calculator registration, UI composition, event wiring, and orchestration.

Extraction is performed in this order: model, pure geometry, routing, SVG generation, I/O, then interactions. Each extraction preserves the current saved JSON format and observable UI behavior. Internal APIs use plain data objects and return values rather than reading arbitrary DOM state where practical.

No step may combine extraction with formula or behavior redesign. If a defect is discovered, first add a failing regression test that reproduces it, then fix it separately.

## Error Handling

- Test setup failures distinguish missing packages, missing Chromium, assertion failures, and unexpected process termination.
- Imported files report actionable Chinese error messages without exposing stack traces in the page.
- Storage operations return typed outcomes and never treat a failed write as success.
- Failed migrations leave the original stored value untouched.
- Schematic import errors identify the invalid section or field and do not replace the currently open drawing.
- Module-level rendering isolation in `app.js` remains the final UI fallback.

## Compatibility Requirements

- Existing local files and Cloudflare-hosted pages remain usable without Node.js.
- Existing localStorage and IndexedDB data remain readable.
- Existing calculator IDs, navigation groups, public globals, export filenames, and JSON formats remain stable unless a migration explicitly supports the previous format.
- Existing Chromium tests continue to use `file://` URLs.
- Generated reports and exported engineering values must not change merely because code moved between files.
- Third-party minified libraries remain vendored and are excluded from first-party refactoring and syntax scans where appropriate.

## Documentation

Update the developer documentation to describe:

- the current v2.0.0 architecture and entry point;
- optional developer prerequisites and Corepack/pnpm setup;
- commands for syntax, unit, browser, and full test runs;
- Playwright Chromium installation;
- storage ownership, schema migration, and backup behavior;
- the schematic file map and ordered script dependencies;
- the distinction between the static runtime and optional development tooling.

The public user documentation continues to emphasize that no installation is required to use the calculator.

## Verification and Acceptance Criteria

The work is accepted when all of the following are demonstrated with fresh command output:

1. A clean checkout can install declared development dependencies through the documented package-manager command.
2. The declared Chromium installation command succeeds.
3. Syntax checks pass for every first-party JavaScript and `.cjs` test file.
4. All existing pure Node.js tests pass.
5. All existing Playwright tests start with repository-local dependencies and pass, or any pre-existing functional failure is documented with a reproducible failing test before implementation continues.
6. Golden calculation cases pass within their declared tolerances.
7. Storage compatibility tests read representative legacy records and preserve data when writes or migrations fail.
8. Security tests reject oversized, malformed, incorrectly typed, and unsafe imported values while accepting valid historical exports.
9. Schematic regression tests pass after each extraction stage and exported JSON remains backward compatible.
10. Opening `index.html` directly still loads every registered calculator without network access.
11. Git diff contains no generated browser binaries, dependency directories, test reports, secrets, or unrelated user changes.

## Delivery Strategy

Implement in five independently reviewable phases:

1. Reproducible development dependencies and unified test commands.
2. Golden formula fixtures and regression tests.
3. Shared safety and storage foundations with compatibility tests.
4. Incremental schematic extraction guarded by the existing and new tests.
5. Full offline verification and documentation refresh.

Each phase follows test-driven development for new behavior and bug fixes. No phase is considered complete until its focused tests and the relevant regression suite have passed.
