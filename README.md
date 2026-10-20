# Frigg API Module Library

Welcome to the Frigg API Module Library! This repository contains API modules that connect third-party services with Frigg.

Browse the generated index: **[MODULES.md](./MODULES.md)** (module, package name, version, auth type, status).

## Directory layout

| Path | Purpose |
| --- | --- |
| [`modules/`](./modules/) | All API modules (flat). Publishable npm packages discovered by Lerna / `auto`. |
| [`archive/`](./archive/) | Retired modules (not published). Example: `qbo` (replaced by `quickbooks`). |
| [`tools/`](./tools/) | Non-published tooling (e.g. scale-test lambda + OpenAPI). Marked `private`. |

Status in `MODULES.md` records whether a module is `v1-ready`, `needs-updating` (legacy Frigg v0-era), or `archived`.

## Releases

This monorepo uses [intuit/auto](https://github.com/intuit/auto) with Lerna independent versioning.

- Publishable packages: `modules/*` only (`lerna.json` + `.autorc` / `package.json` `"auto"`).
- Not published: `archive/*`, `tools/*`.
- Canary / release publishes require the `release` label (`onlyPublishWithReleaseLabel`).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to add or update a module, regenerate `MODULES.md`, and run tests.

Thank you for your interest in the Frigg project! If you have questions, [contact us](https://docs.friggframework.org/support/support).

**~ The Frigg Maintainers** (Should we start a band?)
