# Contributing

## Layout

API modules live in a **flat** `modules/<name>/` directory (formerly `packages/v1-ready/<name>` and `packages/needs-updating/<name>`).

- Put new modules under `modules/<name>/`.
- Do **not** add packages under `packages/`, `archive/`, or `tools/` unless you intend non-published tooling or an archive.
- Package names stay `@friggframework/api-module-<name>`; only the filesystem path changed.

Retired modules go under `archive/<name>/` and are excluded from workspaces / Lerna publish.

Scale-test helpers live under `tools/scale-test/` (lambda + OpenAPI) and remain `private`.

## MODULES.md index

`MODULES.md` is generated. After adding, removing, or renaming a module (or changing `package.json` name/version or auth definition):

```bash
npm run modules:index
```

Commit the updated `MODULES.md`. CI fails if it is stale (`npm run modules:index:check`).

## Local checks

```bash
npm install
npm test --workspaces --if-present
npm run modules:index:check
npx lerna ls   # should list only modules/* packages
```

## Releases

Publishing is handled by `auto` + Lerna on merge to `next` / `main`. Only `modules/*` is in `lerna.json` `packages`. Apply the `release` label for canary/release publishes.
