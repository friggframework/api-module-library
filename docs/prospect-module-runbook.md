# Prospect Module Runbook

**Status:** Draft v1 · 2026-09-01
**Purpose:** industrialize the Reevo workflow — take a VC/PE portfolio company's API
docs to a working Frigg demo experience in the playbook — so a new tier-A module
is hours, not days. This is workstream 7 of `business-os/docs/specs/vc-pe-playbook-platform.md`
§4.

**Ground truth this runbook is built from:** the Reevo module (`packages/v1-ready/reevo/`
plus companions `gong`/`fireflies`/`fathom`/`otter`/`quo`) lives on
`origin/claude/reevo-conversation-modules` (PR #97) in this repo, not on `main`.
It was published to npm as `@friggframework/api-module-reevo@1.0.1-next.0`
(2026-08-19) against `@friggframework/core@2.0.0-next.x`. Every template and
convention below is read directly from those files (`git show
origin/claude/reevo-conversation-modules:packages/v1-ready/reevo/<file>`) plus
the OAuth2 pattern already in this repo's `packages/v1-ready/hubspot/` and
`packages/v1-ready/deel/`, and the Frigg-side pieces (`createFriggBackend`,
`frigg install`, Management UI) read from the `frigg` repo's `origin/next`
branch — none of this lives on either repo's `main`. **Do not check out the
Reevo branch** — read files from it with `git show`, as this runbook and the
scaffolder do.

## The end-to-end flow, in one picture

```
portfolio company's API docs
        │
        ▼
1. <name>.openapi.yaml  (hand-authored, canonical contract)
        │
        ▼
2. scripts/scaffold-module.mjs <name> --auth apikey|oauth2
        │            (generates packages/v1-ready/<name>/ skeleton)
        ▼
3. Implement api.js 1:1 against operationIds
        │
        ▼
4. tests/spec-sync.test.js passes (spec ↔ client stay honest)
        │
        ▼
5. npm publish --tag next  →  @friggframework/api-module-<name>
        │
        ▼
6. Hand-assemble a demo backend.js (createFriggBackend) + counterpart modules
        │
        ▼
7. frigg install <name>   (auto-wires the published module into backend.js)
        │
        ▼
8. Management UI (origin/next) — simulated user + connection, click through
        │
        ▼
9. Recorded walkthrough or live sandbox link → the playbook page's demo strip
```

---

## 1. Author `<name>.openapi.yaml` from vendor docs

This is the canonical, machine-readable contract everything else is checked
against. Reevo is the precedent for the common case in this motion: **most
portfolio companies at seed/Series A/B publish no OpenAPI spec at all** — you
author one from their help docs / API reference pages, same as
`reevo.openapi.yaml` was authored from
`https://help.reevo.ai/Data-management-and-migration/Integrations-With-Other-Tools`.
If the company *does* publish a spec (more common past Series C, or for
API-first companies), start from that instead — it's faster and less
error-prone than reading prose docs.

Conventions to match (all present in `reevo.openapi.yaml`):

- `info.description` states plainly whether this is vendor-published or
  hand-authored from help docs, and credits Left Hook as author when
  hand-authored — this is the thing a future session needs to know before
  trusting it as ground truth.
- One `operationId` per method you intend to write in `api.js` — camelCase,
  matching the method name exactly (`spec-sync.test.js` enforces this).
- `security` + `components.securitySchemes` declares the real auth scheme
  (`apiKey` in a header, or `oauth2` with an `authorizationCode` flow) — the
  scaffolder generates a stub of the right shape for your `--auth` choice;
  replace the stub URLs with the vendor's real ones.
- Request/response bodies can be as detailed as you have patience for; the
  spec-sync test only checks operationId ↔ method-name and the security
  scheme, not schema completeness. Fill in `required` fields at minimum —
  they're what a next session will trust when writing calls.

**Time-box this.** Reevo's spec covers 17 operations across accounts,
contacts, opportunities, tasks, activities, and users — that took one sitting.
For a demo module you don't need full API coverage, only the handful of
operations the demo narrative actually calls.

## 2. Scaffold the module

```bash
node scripts/scaffold-module.mjs <name> --auth apikey|oauth2 [--label "Display Name"] [--category X]
```

- `<name>` — lowercase kebab-case (e.g. `acme-crm`). Becomes
  `packages/v1-ready/<name>/` and the npm package
  `@friggframework/api-module-<name>`.
- `--auth apikey|oauth2` — **required**. Picks the Reevo (`ApiKeyRequester` +
  sha256 key-fingerprint `externalId`) or hubspot/deel (`OAuth2Requester` +
  `getTokenFromCode`) pattern. See §5 below for how to choose.
- `--label "Display Name"` — optional, defaults to a Title-Cased version of
  `<name>`. Used in `defaultConfig.json`, `README.md`, generated test
  `describe()` blocks.
- `--category X` — optional, comma-separated (e.g. `"CRM,Sales"`). Defaults to
  `Other`. Feeds `defaultConfig.json.categories`.

It **refuses to overwrite** an existing `packages/v1-ready/<name>/` directory
(exits 1 with no changes) — this is deliberate; if you need to re-scaffold,
delete the directory yourself first so you don't silently clobber hand-written
work.

Generated files (byte-for-byte structure lifted from `packages/v1-ready/reevo/`,
read via `git show`):

```
packages/v1-ready/<name>/
├── index.js                    # module.exports = { Api, Definition }
├── api.js                      # URLs map + one example method (listItems) + TODOs
├── definition.js               # requiredAuthMethods for the chosen auth mode
├── defaultConfig.json          # name/label/authType/categories/description
├── package.json                # @friggframework/api-module-<name>, matches Reevo's structure
├── LICENSE.md                  # MIT, Left Hook Inc — same as every v1-ready module
├── .env.example
├── README.md
├── <name>.openapi.yaml         # valid OpenAPI 3.0 stub, one path (listItems)
└── tests/
    ├── api.test.js             # auth + example-endpoint request-shape tests
    ├── definition.test.js      # requiredAuthMethods wiring tests
    └── spec-sync.test.js       # functional: YAML operationIds ⊆ Api.prototype methods
```

The scaffold is deliberately minimal (one example method, `listItems`) rather
than pre-guessing the real endpoints — every module's real shape is different,
and a wrong guess is worse than an honest `TODO`. `tests/spec-sync.test.js`
passes on the untouched skeleton (see §4 and the proof run in this repo's
session log), so `npm test` is green from the moment you scaffold — it goes
red the moment you add an operation to the YAML without a matching method, or
vice versa, which is the whole point.

**Verified:** running this generator for both `--auth apikey` and
`--auth oauth2` on a throwaway module name and running `npm test` against the
untouched output passes 15/15 and 16/16 respectively. See "Proof run" at the
bottom of this document for the exact commands and output.

## 3. Implement `api.js` 1:1 against operationIds

Replace `listItems()` and grow the `URLs` map, one method per operationId in
your `<name>.openapi.yaml`. Rules, lifted from `packages/v1-ready/reevo/api.js`:

- **One public method per operationId, same name.** `spec-sync.test.js` is
  the enforcement; keep it green as you go rather than writing everything
  then reconciling at the end.
- Use the underlying `_get/_post/_patch/_delete` helpers from the base
  `Requester` class (`ApiKeyRequester`/`OAuth2Requester` both extend it) —
  pass `{ url, query, headers, body }`. Reevo's `retrieveAccountAndContact`
  is the pattern for a method with validated exclusive-or parameters; its
  `shiftOpportunityStage` is the pattern for a nested action path
  (`/opportunities/{id}/shift_stage`) that a plain CRUD update doesn't cover.
- Keep a `testAuth()` method — a cheap, always-available authenticated call —
  it's what `definition.js`'s `testAuthRequest` delegates to, and it's what
  `frigg auth test` exercises at connection time.
- Document the required fields for non-trivial bodies in a one-line JSDoc
  comment above each method (see every method in `reevo/api.js` for the
  style) — it's the fastest way for the next person (or your future self,
  writing the demo script) to know what a call needs without re-reading the
  YAML.

## 4. `spec-sync.test.js`

Copied structure from `packages/v1-ready/reevo/tests/spec-sync.test.js`:
parses the YAML with `js-yaml`, collects every `operationId` across all
HTTP-method entries in `paths`, collects every own-prototype method on `Api`,
and asserts the first is a subset of the second. Two more assertions (base
URL match, security-scheme shape) catch the "the spec still says the staging
URL" and "the auth type in the YAML doesn't match reality" classes of drift.

This is a **functional** test, not a lint rule — it actually loads `Api` and
introspects `Api.prototype`, so a method typo or a forgotten add-to-YAML fails
loudly in `npm test`, not silently at review time. Keep this property when
hand-editing the generated test file: don't restate operationIds as a literal
array (that can drift from the YAML independently), always derive them from
`yaml.load(...)`.

## 5. Auth patterns: API key vs OAuth2

Two precedents in this repo, pick based on what the vendor actually offers —
don't default to OAuth2 because it "feels more standard":

| | API key (Reevo pattern) | OAuth2 (hubspot/deel pattern) |
|---|---|---|
| Base class | `ApiKeyRequester` | `OAuth2Requester` |
| Auth header | `addAuthHeaders()` injects `headers[api_key_name] = api_key` — you set `api_key_name` in the constructor (Reevo uses `x-api-key`; confirm the vendor's real header) | `addAuthHeaders()` injects `Authorization: Bearer <access_token>` — provided by the base class, no override needed |
| `externalId` (who is this credential) | **Derive by fingerprinting the key**: `crypto.createHash('sha256').update(apiKey).digest('hex')`. Static API keys often have no "who am I" endpoint that returns an account id, so the fingerprint is the only stable, non-reversible identifier that maps the same key to the same entity every time. Reevo does exactly this. If the vendor **does** expose an identity endpoint, prefer its real id over fingerprinting — see the TODO the scaffolder leaves in `definition.js`. | **Call a real profile endpoint** (hubspot's `getUserDetails()` → `portalId`; deel's `getTokenIdentity()` → `id`) — OAuth2 flows almost always have one, because the authorization step already establishes who granted consent. |
| `requiredAuthMethods.getToken` | Not applicable — `setAuthParams` is a no-op; there's no code exchange | `api.getTokenFromCode(code)` (or `getTokenFromCodeBasicAuthHeader(code)` if the vendor requires Basic-Auth token exchange — deel does) |
| `apiPropertiesToPersist.credential` | `['api_key']` | `['access_token', 'refresh_token']` |
| `env` block | `{ api_key: process.env.<NAME>_API_KEY }` | `{ client_id, client_secret, redirect_uri: \`${REDIRECT_URI}/<name>\`, scope }` |
| `.env.example` | one `<NAME>_API_KEY` line | `<NAME>_CLIENT_ID` / `<NAME>_CLIENT_SECRET` / `<NAME>_SCOPE` + shared `REDIRECT_URI` |

Both base classes live in `@friggframework/core@2.0.0-next.x` (confirmed on
the `frigg` repo's `origin/next` — `packages/core/modules/requester/api-key.js`
and `oauth-2.js` — exported from the package root as `ApiKeyRequester` /
`OAuth2Requester` / `ModuleConstants` / `get`, same import line Reevo uses:
`require('@friggframework/core')`). `OAuth2Requester` also supports
`client_credentials` and `password` grants if a vendor needs server-to-server
auth instead of the standard authorization-code flow — see its JSDoc for the
shape; none of the modules in this repo currently use them.

The scaffolder generates the correct `requiredAuthMethods` shape for whichever
`--auth` you pick — you should only need to fill in the real base/auth/token
URLs and the real identity call.

## 6. Publish to npm with the `next` dist-tag

Reevo shipped as `1.0.1-next.0` while its checked-in `package.json` still said
`1.0.0` — meaning the version was bumped **at publish time**, not
pre-committed. Do the same:

```bash
cd packages/v1-ready/<name>
npm install                      # from the repo root the first time, so workspace hoisting picks up the new package
npm test                         # must be green before publishing anything
npm version prerelease --preid=next --no-git-tag-version   # 1.0.0 -> 1.0.1-next.0
npm publish --tag next --access public
```

`publishConfig.access: public` is already set by the scaffolder (needed
because `@friggframework` is a scoped org). The `--tag next` matters
independently of the version string — without it, `npm install
@friggframework/api-module-<name>` would need an explicit version pin, and
`frigg install <name>`'s package search/version resolution (see §8) needs to
land on a version, not fail with "no `latest`".

**Note on this repo's `auto` release automation**: the root `package.json`
has an `auto` config (the `intuit/auto` tool) for label-gated PR-merge
releases. On `origin/claude/reevo-conversation-modules` that config includes
`prereleaseBranches: ["next"]` and `onlyPublishWithReleaseLabel: true` — i.e.
an automated path exists when merging into `next` with a release label. **On
the current branch that config is absent** (just a bare `plugins` list, no
`prereleaseBranches`/`versionBranches`) — don't assume the automated path is
wired here without checking `package.json`'s `auto` block first. The manual
`npm version` + `npm publish --tag next` path above is what's actually
verified to work and is what Reevo used in practice.

## 7. Assemble the demo app

**`create-frigg-app` is unpublished from npm and `frigg init` currently
crashes (missing templates)** — confirmed by reading the `frigg` repo's own
`.claude/skills/bootstrap-frigg-integration/SKILL.md` on `origin/next`, which
states this explicitly and gives the working manual path. There is no
checked-in `backend.js` template in `packages/devtools/frigg-cli/templates/`
on that branch either (checked — the directory doesn't exist there). So:

**Option A — clone an example app** (fastest if one fits):
```bash
git clone https://github.com/friggframework/example-frigg-applications
# copy the closest example, npm install
```

**Option B — hand-assemble** (what the Reevo demo actually needs, since the
narrative is bespoke per portfolio company):
```bash
mkdir <firm>-<company>-demo && cd <firm>-<company>-demo
npm init -y
npm install @friggframework/core @friggframework/api-module-<name> \
            @friggframework/api-module-<counterpart-1> \
            @friggframework/api-module-<counterpart-2>
```

`index.js` — the app definition, subclassing `IntegrationBase` per module
pairing and exporting the list `createFriggBackend` expects
(`{ integrations: [...] }`, per `@friggframework/schemas`' app-definition
schema):

```javascript
const { IntegrationBase, createFriggBackend } = require('@friggframework/core');

class DemoIntegration extends IntegrationBase {
    static Definition = {
        name: '<company>-demo',
        version: '1.0.0',
        display: {
            label: '<Company> Integration Demo',
            description: 'Syncs <company> with <counterpart>',
            category: '<category>',
        },
        modules: {
            primary: require('@friggframework/api-module-<name>'),
            counterpart: require('@friggframework/api-module-<counterpart-1>'),
        },
        routes: [{ path: '/sync', method: 'POST', event: 'SYNC_DEMO_DATA' }],
    };

    constructor() {
        super();
        this.events = { SYNC_DEMO_DATA: { handler: this.syncDemoData } };
    }

    async syncDemoData() {
        const records = await this.primary.api.listItems();     // TODO: real method
        return this.counterpart.api.createSomething(records);    // TODO: real method
    }
}

const appDefinition = { integrations: [DemoIntegration] };

module.exports = { appDefinition, friggBackendPromise: createFriggBackend(appDefinition) };
```

Mount the resulting router in Express (`app.use('/api/frigg', await
friggBackendPromise)`) or a serverless handler per
`@friggframework/core`'s `createFriggBackend` contract. `frigg db:setup` then
`frigg start` runs it locally against `serverless-offline`.

## 8. `frigg install <name>` — auto-wire

Run **inside the demo backend** (it walks up to find the nearest
`package.json`, per `findNearestBackendPackageJson()`):

```bash
frigg install <name>
```

What it actually does (read from `packages/devtools/frigg-cli/install-command/index.js`
on `origin/next`):
1. Searches/resolves the npm package name (interactive picker if you pass no
   name) and validates it exists at the resolvable dist-tag.
2. `npm install`s it into the backend.
3. Loads the installed package's `Config.label` + `Api` class and generates an
   integration file for it (`createIntegrationFile`).
4. **Updates `backend.js` automatically** (`updateBackendJsFile`) — this is
   the "auto-wires" step referenced in the plan doc; you don't hand-edit the
   integrations array for a freshly-installed module.
5. Commits the changes (`commitChanges`) and walks you through any required
   env vars (`handleEnvVariables`) by reading the module's `.env.example`.

Run it once per module (primary + each counterpart) after each is published.

## 9. Counterpart module selection guidance

Pick 2–3 modules that make the demo narrative *believable in the company's
category*, not a random assortment of whatever's already published. Rules of
thumb from how the Reevo cohort (`gong`/`fireflies`/`fathom`/`otter`/`quo`) was
built:

- **They should be tools the company's actual customers plausibly already
  use.** Reevo is a CRM aimed at sales teams doing AI-assisted outreach — the
  companion set is meeting-intelligence tools (Gong, Fireflies, Fathom,
  Otter) plus a second CRM-adjacent tool (Quo), because "sync your call
  notes into the CRM automatically" is the story a Revenue OS buyer
  recognizes instantly.
- **Prefer modules that already exist in `packages/v1-ready/` or
  `packages/needs-updating/`** over building new ones — check both before
  committing to a build. `ls packages/v1-ready/` for the current inventory.
- **If none exist, build them the same way** — this runbook's steps 1–4,
  scoped to the 1–2 endpoints the demo actually calls. A companion module for
  a demo does not need the coverage a real integration would; it needs to
  make one convincing round-trip.
- **2–3 is the right number.** One companion reads as a toy; five is more
  build time than the demo narrative needs. Reevo's five-module companion set
  was building out a whole category story for the module library, not one
  company's demo — don't over-invest per portfolio company.

## 10. Management UI staging

Location: `packages/devtools/management-ui/` on the `frigg` repo's
`origin/next` (not `main`). It's a Vite + React app with an Express API
server (`server/`) and WebSocket live updates.

```bash
cd packages/devtools/management-ui
npm install
npm run dev:server     # frontend (Vite) + backend concurrently
```

What it gives you for staging a demo (from `server/api/users/simulation.js`
and `docs/phase2-integration-guide.md`, both on `origin/next`):

- **Simulated users** — `POST /api/users/dummy` (and `/bulk`) creates
  isolated test users with generated ids; no real end-user account needed for
  a walkthrough.
- **Simulated auth + actions** — `POST /api/users/simulation/authenticate`
  mints a session for a `{userId, integrationId}` pair;
  `POST /api/users/simulation/action` drives actions within that session.
  Both broadcast over the WebSocket handler, which is what makes the UI feel
  live during a recorded walkthrough.
- **Connection management** — the standard install → configure → create
  test user → generate credentials → create connection → test connection
  flow is scripted as `phase2Workflows.setupIntegration(name, {...})`
  (`docs/phase2-integration-guide.md`), or click through it by hand in the
  UI for a recording.
- **Integration discovery/install from the UI itself** — it can search npm
  for `@friggframework/*` packages and install them, which is an alternative
  to running `frigg install <name>` from the CLI if you want the whole demo
  build to happen on-camera.

## 11. What ships in the playbook

Per §2 of the plan doc, the playbook page's demo strip links to one of:

- **Recorded walkthrough** (default choice for most tier-A companies) — a
  short screen recording of the Management UI flow above: install the
  module, create a simulated user, run one real sync action, show the
  synced record landing in the counterpart module. Cheapest to produce,
  works for any auth type including ones you can't get live test credentials
  for, and can't break during a partner's viewing.
- **Live sandbox** (reserve for the highest-conviction 1–2 companies per
  cohort, or ones a partner has asked to click through themselves) — a
  deployed instance of the demo backend + Management UI, gated behind the
  same collab-doc auth as the rest of the playbook. Costs real hosting +
  upkeep (a stale sandbox reads worse than no sandbox), so only stand one up
  when the co-investment conversation is live enough to justify it.

Default to recorded. Upgrade to live only on explicit ask.

## Effort estimates

Based on the actual Reevo build (17-operation spec, 12-method client, full
test suite, one sitting) and the scaffolder's floor (skeleton + green tests,
proven in minutes — see Proof run below):

| Task | Estimate | Notes |
|---|---|---|
| Author `<name>.openapi.yaml` from vendor docs | 1–3 hrs | Scales with how well-organized the vendor's docs are and how many operations the demo narrative needs (aim for 5–15, not full coverage) |
| Scaffold + implement `api.js` to green `spec-sync` | 1–2 hrs | Scaffold itself is seconds; the time is writing real methods against the YAML |
| Full module incl. README polish, `.env.example` accuracy, edge-case tests | +1–2 hrs | Optional depth pass — skip for a demo-only module, do it if the module might graduate to the general library |
| **One module, demo-scoped, total** | **~half a day (3–5 hrs)** | Reevo itself (broader scope, 6-module companion set) was "one sitting" — a single demo-scoped module is meaningfully less |
| Publish to npm (`next` tag) | 15 min | Mechanical once tests are green |
| Hand-assemble demo backend + `frigg install` each module | 1–2 hrs | Per demo app, not per module — amortizes across the 2–3 companion modules |
| Management UI staging (simulated user, one real action, capture) | 1–2 hrs | Recorded walkthrough. Live sandbox adds ongoing hosting/upkeep cost, not just build time |
| **One company's full demo (1 primary + 2 companions, all new)** | **~2 days** | Assumes 1–2 companions already exist in the library; add ~half a day per companion that must be built from scratch |
| **One company's full demo (companions already published)** | **~1 day** | Primary module build/publish + backend assembly + staging only |

For a cohort of 8–12 firms with 2–3 tier-A companies each, budget the
companion-module cost **once per distinct category** (companions get reused
across companies in the same category), not once per company.

## Divergences from the Reevo layout, and why

- **`LICENSE.md` is generated even though the task brief's file list didn't
  name it.** Every module in `packages/v1-ready/` (Reevo, hubspot, deel)
  carries one, byte-identical MIT/Left Hook Inc text — omitting it would be
  the actual divergence from repo convention, so the scaffolder includes it.
- **No `jest.config.js` is generated.** Reevo's own directory has none —
  Jest's default `testMatch` already picks up `tests/*.test.js`, confirmed by
  running `npx jest` against the generated skeleton with zero config. `deel`
  has one only because it also has `globalSetup`/`globalTeardown` fixtures
  this scaffold doesn't need. Add one only if a module later needs
  setup/teardown hooks.
- **The scaffolded `api.js` has exactly one example method (`listItems`),
  not a full CRUD set.** The task brief called for "URLs map + example
  method + TODO markers", and a fabricated set of plausible-looking methods
  for a vendor we haven't read the docs for would be actively misleading —
  worse than an honest single example plus TODOs. Every real module's method
  set is bespoke to the vendor.
- **`spec-sync.test.js`'s security-scheme assertion branches on `--auth`**,
  where Reevo's (apiKey-only) hardcodes the `x-api-key` check. This is a
  generalization forced by supporting both auth modes from one scaffolder,
  not a divergence in intent — the apiKey branch is verbatim Reevo's
  assertion.
- **`package.json`'s `devDependencies` are copied verbatim from Reevo's**,
  including `@aws-sdk/client-scheduler` and `jest-environment-jsdom`, which
  the generated skeleton doesn't actually exercise (no scheduler code, no
  DOM). Left in place because the task explicitly asked to match Reevo's
  package.json structure, and because a real module built from this skeleton
  is likely to grow into needing them (Reevo's own module doesn't use
  `jest-environment-jsdom` in its tests either, as far as could be
  determined from the test files read — it's inherited monorepo convention,
  not a per-module necessity).
- **No `CHANGELOG.md` is generated**, unlike `deel`'s directory (which has
  one). Reevo's directory has none either — this is not a divergence from
  the ground-truth module, just a note that not every `v1-ready` module
  follows identical conventions and Reevo is the one this scaffolder tracks.

## Proof run (this session)

Scaffolder invocation for both auth modes, from the repo root:

```bash
node scripts/scaffold-module.mjs scaffoldtest-apikey --auth apikey --label "Scaffold Test" --category "Testing,CRM"
node scripts/scaffold-module.mjs scaffoldtest-oauth2 --auth oauth2 --label "Scaffold Test OAuth" --category "Marketing"
```

Re-running the first command against the same name confirmed the
overwrite guard: `Error: packages/v1-ready/scaffoldtest-apikey already exists
— refusing to overwrite.` (exit 1, no files touched).

After `npm install` at the repo root (workspace hoist) and `npm test`
(`npx jest`) in each generated package directory, on the **untouched**
generated skeleton:

```
# packages/v1-ready/scaffoldtest-apikey
PASS tests/api.test.js
PASS tests/spec-sync.test.js
PASS tests/definition.test.js
Test Suites: 3 passed, 3 total
Tests:       15 passed, 15 total

# packages/v1-ready/scaffoldtest-oauth2
PASS tests/definition.test.js
PASS tests/api.test.js
PASS tests/spec-sync.test.js
Test Suites: 3 passed, 3 total
Tests:       16 passed, 16 total
```

Both throwaway directories were deleted after the proof run
(`rm -rf packages/v1-ready/scaffoldtest-apikey packages/v1-ready/scaffoldtest-oauth2`),
along with the `node_modules`/`package-lock.json` churn the install produced
(the pre-existing tracked `package-lock.json` was restored via `git checkout`
after being accidentally `rm`'d alongside `node_modules` — verified clean via
`git status` afterward, only `scripts/` remains untracked).
