# Module documentation producer pilot

Implements the producer half of Frigg ADR-065 for
`packages/v1-ready/hubspot` only. The matching receiver and setup instructions live
in `friggframework/frigg/tools/module-docs/README.md`.

## Authoring

`module-docs.json` is validated against `descriptor.schema.json`. Package name,
version, license and declared Node/Frigg compatibility come from package.json;
do not duplicate them in the descriptor. `testedCompatibility` is empty unless
specific runtime versions have actually been tested. Exported extensions must
agree with the package index. HubSpot's existing API, authorization and webhook
code is unchanged by this pilot.

The five authored pages and `reference.json` cover setup, OAuth, first call,
operating behavior, extensions, known limitations, release changes and support.
The builder creates the sixth page from public method signatures and those
annotations. This pilot supports the package's current class-method syntax;
extend the extractor and runtime-inventory test before introducing other syntax.
Annotations are authored facts, not inferred provider schemas. The first-call
fixture checks `listContacts` with a fake Requester, including the first-page
cursor and explicit properties. It does not test live HubSpot or OAuth refresh.

## Exact release bundles

The package's `prepack` hook builds `module-docs.bundle.json` after versioning and
before the package is packed. The explicit package `files` list includes the generated bundle even though Git
ignores it; `.npmignore` keeps local secrets and test scaffolding out. Committed package source is checked against
`GITHUB_SHA` (or HEAD locally); auto/lerna may change the package version,
changelog and temporary `gitHead`. The bundle records the source input SHA and exact resolved package
metadata so temporary prerelease commits/reset do not lose version provenance.

`contract.cjs` and `registry.cjs` are byte-identical to the receiver copies. The
published npm tarball is the durable bundle store. Its sha512 integrity is added
by the receiver after publication rather than creating a circular hash in the
package. JSON canonicalization makes bundle digests repeatable.

The local auto plugin clears old candidate state before shipit and records only
candidates from successful non-canary runs. A no-op run emits an empty list.
The separate delivery job retrieves each exact npm version, verifies integrity
and candidate digest, then dispatches the package/version to Frigg. Canary docs
are built and validated but are not dispatched. Failed dispatches do not rerun
shipit or republish packages.

`MODULE_DOCS_ENABLED` is off by default. When enabling, configure the destination
workflow on its default branch, App permissions, variable and secret described
in the receiver README. The stable release branch needs the same producer before
stable releases can carry bundles. Never backfill an old npm release by generating
docs from the current branch. Immutable npm versions lacking a bundle are not
eligible for this pilot's import path.

## Verification and retry

```bash
node --test tools/module-docs/*.test.cjs
npm pack --workspace @friggframework/api-module-hubspot --pack-destination /tmp
node tools/module-docs/check-pack.cjs /tmp
```

Packing performs source checks; commit authored sources first. No dependency
installation or live credentials are needed for these checks. It does not publish
a package. CI runs these checks on changes to the pilot and producer tooling.

After publication, use **Retry module documentation delivery** with the exact
package/version. It verifies npm and dispatches again, never calls npm publish.
The workflow must also exist on the default branch for manual dispatch. Delivery
results are recorded in `.module-docs/delivery.json` and an Actions artifact. A
dispatch success means accepted by GitHub, not yet imported, merged or published.
After transient Actions artifacts expire, the npm-embedded bundle remains the
source for manual retry. The destination's release manifests record successful
imports durably in Git.

Use `[skip release]` in a tooling-only commit to suppress the repository's release
job while keeping documentation checks runnable. Do not merge this pilot to a
release branch with that marker if a package publication is intended.
