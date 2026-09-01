#!/usr/bin/env node
/**
 * scaffold-module.mjs — generate a new packages/v1-ready/<name>/ API module
 * in the Reevo file layout (packages/v1-ready/reevo/, fetched from
 * origin/claude/reevo-conversation-modules).
 *
 * Usage:
 *   node scripts/scaffold-module.mjs <name> --auth apikey|oauth2 [--label "Display Name"] [--category X]
 *
 * Examples:
 *   node scripts/scaffold-module.mjs acme-crm --auth apikey --label "Acme CRM" --category "CRM,Sales"
 *   node scripts/scaffold-module.mjs bigco --auth oauth2 --label "BigCo" --category "Marketing"
 *
 * Deps: node:fs, node:path only — no npm install required to run this script.
 *
 * Refuses to overwrite an existing packages/v1-ready/<name>/ directory.
 *
 * Every template here is derived from the actual Reevo module files (read via
 * `git show origin/claude/reevo-conversation-modules:packages/v1-ready/reevo/<file>`)
 * plus the OAuth2 pattern used by packages/v1-ready/hubspot and deel. See
 * docs/prospect-module-runbook.md for the full workflow this scaffolder is
 * step 2 of.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

function usageAndExit(message) {
    if (message) {
        console.error(`Error: ${message}\n`);
    }
    console.error(
        [
            'Usage:',
            '  node scripts/scaffold-module.mjs <name> --auth apikey|oauth2 [--label "Display Name"] [--category X]',
            '',
            'Options:',
            '  <name>        lowercase kebab-case module name, e.g. acme-crm (becomes',
            '                packages/v1-ready/<name>/ and @friggframework/api-module-<name>)',
            '  --auth        apikey | oauth2 (required)',
            '  --label       Display name shown in defaultConfig.json / README (default:',
            '                Title Cased version of <name>)',
            '  --category    Comma-separated categories for defaultConfig.json (default: Other)',
            '',
            'Examples:',
            '  node scripts/scaffold-module.mjs acme-crm --auth apikey --label "Acme CRM" --category "CRM,Sales"',
            '  node scripts/scaffold-module.mjs bigco --auth oauth2 --label "BigCo" --category "Marketing"',
        ].join('\n')
    );
    process.exit(1);
}

function parseArgs(argv) {
    if (argv.length < 1) usageAndExit();
    const [name, ...rest] = argv;
    const opts = { auth: null, label: null, category: null };
    for (let i = 0; i < rest.length; i++) {
        const flag = rest[i];
        if (flag === '--auth') {
            opts.auth = rest[++i];
        } else if (flag === '--label') {
            opts.label = rest[++i];
        } else if (flag === '--category') {
            opts.category = rest[++i];
        } else {
            usageAndExit(`unknown argument "${flag}"`);
        }
    }
    return { name, ...opts };
}

function assertValidName(name) {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
        usageAndExit(
            `"${name}" is not a valid module name — use lowercase letters, digits, and hyphens, starting with a letter (e.g. acme-crm)`
        );
    }
}

// kebab-case -> PascalCase, e.g. "acme-crm" -> "AcmeCrm"
function toModelName(name) {
    return name
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}

// kebab-case -> Title Case, e.g. "acme-crm" -> "Acme Crm"
function toDefaultLabel(name) {
    return name
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

// kebab-case -> SCREAMING_SNAKE_CASE, e.g. "acme-crm" -> "ACME_CRM"
function toEnvPrefix(name) {
    return name.toUpperCase().replace(/-/g, '_');
}

function writeFile(filePath, contents) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents, 'utf8');
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function indexJsTemplate() {
    return `const { Api } = require('./api');
const { Definition } = require('./definition');

module.exports = {
    Api,
    Definition,
};
`;
}

function defaultConfigTemplate({ name, label, auth, categories }) {
    const config = {
        name,
        label,
        authType: auth === 'oauth2' ? 'oauth2' : 'apiKey',
        productUrl: `https://TODO-${name}-website.example.com`,
        apiDocs: `https://TODO-${name}-api-docs.example.com`,
        logoUrl: `https://TODO-${name}-website.example.com/favicon.ico`,
        categories,
        description: `${label} API module — TODO describe what this module lets a Frigg app read and write.`,
    };
    return JSON.stringify(config, null, 4) + '\n';
}

function packageJsonTemplate({ name, label }) {
    // Structure mirrors packages/v1-ready/reevo/package.json exactly (read via
    // `git show origin/claude/reevo-conversation-modules:packages/v1-ready/reevo/package.json`) —
    // only name/description differ. See docs/prospect-module-runbook.md for why
    // the version stays 1.0.0 here and is bumped to a `next` prerelease at publish time.
    const pkg = {
        name: `@friggframework/api-module-${name}`,
        version: '1.0.0',
        prettier: '@friggframework/prettier-config',
        description: `${label} API module that lets the Frigg Framework interact with ${label}`,
        main: 'index.js',
        scripts: {
            'lint:fix': 'prettier --write --loglevel error . && eslint . --fix',
            test: 'jest',
        },
        author: '',
        license: 'MIT',
        devDependencies: {
            '@aws-sdk/client-scheduler': '^3.967.0',
            '@friggframework/devtools': '^2.0.0-next.68',
            '@friggframework/test': '^2.0.0-next.68',
            dotenv: '^16.0.3',
            eslint: '^8.22.0',
            jest: '^28.1.3',
            'js-yaml': '^4.1.0',
            'jest-environment-jsdom': '^28.1.3',
            prettier: '^2.7.1',
        },
        dependencies: {
            '@friggframework/core': '^2.0.0-next.107',
        },
        publishConfig: {
            access: 'public',
        },
    };
    return JSON.stringify(pkg, null, 2) + '\n';
}

function licenseTemplate() {
    // Byte-identical to packages/v1-ready/reevo/LICENSE.md.
    return `MIT License

Copyright (c) 2022 Left Hook Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice (including the next paragraph) shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`;
}

function envExampleTemplate({ name, label, auth }) {
    const prefix = toEnvPrefix(name);
    if (auth === 'oauth2') {
        return `# ${label} OAuth2 app credentials.
# TODO: fill in from the app you register in the ${label} developer portal.
${prefix}_CLIENT_ID=your_${name}_client_id_here
${prefix}_CLIENT_SECRET=your_${name}_client_secret_here
${prefix}_SCOPE=TODO_scopes_space_separated
# Shared across OAuth2 modules — the module appends /${name} itself (see definition.js).
REDIRECT_URI=http://localhost:3000/redirect
`;
    }
    return `# ${label} API key, sent as the \`x-api-key\` header (TODO: confirm the real header name).
# TODO: document where in ${label} a user finds this key.
${prefix}_API_KEY=your_${name}_api_key_here
`;
}

function apiJsTemplate({ name, label, auth, apiDocsPlaceholder }) {
    if (auth === 'oauth2') {
        return `const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * ${label} API client.
 *
 * TODO: one or two sentences on what ${label} is and its OAuth2 flow.
 * OAuth2Requester defaults to the \`authorization_code\` grant; it also
 * supports \`client_credentials\` and \`password\` — see
 * @friggframework/core's OAuth2Requester if ${label} needs one of those.
 *
 * Docs: ${apiDocsPlaceholder}
 *
 * The canonical machine-readable contract lives in ./${name}.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 */
class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        // client_id, client_secret, redirect_uri, scope, access_token,
        // refresh_token, and grant_type are all set by OAuth2Requester from params.

        // TODO: set the real base URL.
        this.baseUrl = 'https://api.TODO-${name}.example.com/v1';

        this.URLs = {
            items: '/items',
            itemById: (itemId) => \`/items/\${itemId}\`,
            // TODO: add one entry here per operationId in ${name}.openapi.yaml
            // (follow packages/v1-ready/reevo/api.js for the CRUD + search +
            // custom-action shapes).
        };

        // TODO: confirm the real authorize/token endpoints and any
        // vendor-specific query params — see packages/v1-ready/hubspot/api.js
        // for a fully worked example (it also needs a \`state\` nonce).
        this.authorizationUri = encodeURI(
            \`https://TODO-${name}.example.com/oauth/authorize?client_id=\${this.client_id}&redirect_uri=\${this.redirect_uri}&scope=\${this.scope}&response_type=code\`
        );
        this.tokenUri = 'https://api.TODO-${name}.example.com/oauth/token';
    }

    // ---- Example method (rename/replace with real ${label} endpoints) -------

    /**
     * TODO: replace with a real endpoint. This is the one method the
     * scaffold wires end-to-end (URLs map -> method -> operationId in
     * ${name}.openapi.yaml -> spec-sync test), so every other method should
     * follow the same shape.
     */
    async listItems() {
        const options = {
            url: this.baseUrl + this.URLs.items,
        };
        return this._get(options);
    }

    // TODO: add the rest of the module's methods here, one per operationId
    // in ${name}.openapi.yaml.

    // ---- Auth check ---------------------------------------------------------

    /**
     * Lightweight authenticated request used to validate the access token.
     * TODO: point this at a cheap, always-available ${label} endpoint —
     * ideally one that also returns a stable user/account id for
     * definition.js's getEntityDetails/getCredentialDetails.
     */
    async testAuth() {
        return this.listItems();
    }
}

module.exports = { Api };
`;
    }

    return `const { ApiKeyRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * ${label} API client.
 *
 * TODO: one or two sentences on what ${label} is and the shape of its public
 * API (REST? flat? versioned?).
 *
 * Docs: ${apiDocsPlaceholder}
 *
 * The canonical machine-readable contract lives in ./${name}.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 */
class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);

        // TODO: confirm the real header name ${label} expects for its API key.
        // ApiKeyRequester.addAuthHeaders() injects headers[this.api_key_name] = this.api_key.
        this.api_key_name = 'x-api-key';
        this.api_key = get(params, 'api_key', null);

        // TODO: set the real base URL.
        this.baseUrl = 'https://api.TODO-${name}.example.com/v1';

        this.URLs = {
            items: '/items',
            itemById: (itemId) => \`/items/\${itemId}\`,
            // TODO: add one entry here per operationId in ${name}.openapi.yaml
            // (follow packages/v1-ready/reevo/api.js for the CRUD + search +
            // custom-action shapes).
        };
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    type: 'object',
                    required: ['api_key'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:help': 'TODO: where in ${label} does a user find their API key?',
                        'ui:placeholder': 'Your ${label} API Key',
                    },
                },
            },
        };
    }

    // ---- Example method (rename/replace with real ${label} endpoints) -------

    /**
     * TODO: replace with a real endpoint. This is the one method the
     * scaffold wires end-to-end (URLs map -> method -> operationId in
     * ${name}.openapi.yaml -> spec-sync test), so every other method should
     * follow the same shape.
     */
    async listItems() {
        const options = {
            url: this.baseUrl + this.URLs.items,
        };
        return this._get(options);
    }

    // TODO: add the rest of the module's methods here, one per operationId
    // in ${name}.openapi.yaml.

    // ---- Auth check ---------------------------------------------------------

    /**
     * Lightweight authenticated request used to validate the API key.
     * TODO: point this at a cheap, always-available ${label} endpoint.
     */
    async testAuth() {
        return this.listItems();
    }
}

module.exports = { Api };
`;
}

function definitionJsTemplate({ name, modelName, auth }) {
    if (auth === 'oauth2') {
        const prefix = toEnvPrefix(name);
        return `require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: '${modelName}',
    requiredAuthMethods: {
        setAuthParams: async function (api, params) {},
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            // TODO: replace with a real profile/identity lookup so externalId
            // is a stable id from the vendor, not the raw userId fallback.
            const details = await api.testAuth();
            return {
                identifiers: { externalId: get(details, 'id', userId), userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const details = await api.testAuth();
            return {
                identifiers: { externalId: get(details, 'id', userId), userId },
                details: {},
            };
        },
        testAuthRequest: async function (api) {
            return api.testAuth();
        },
    },
    env: {
        client_id: process.env.${prefix}_CLIENT_ID,
        client_secret: process.env.${prefix}_CLIENT_SECRET,
        redirect_uri: \`\${process.env.REDIRECT_URI}/${name}\`,
        scope: process.env.${prefix}_SCOPE,
    },
};

module.exports = { Definition };
`;
    }

    const prefix = toEnvPrefix(name);
    return `require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

// TODO: confirm ${modelName} never returns a stable external account id at
// auth time. If it does (most APIs that issue a static key still expose a
// "who am I" endpoint), use that id instead of fingerprinting the key — see
// packages/v1-ready/reevo/definition.js for when the fingerprint is the
// right call (no such endpoint exists).
const keyFingerprint = (apiKey) =>
    crypto.createHash('sha256').update(String(apiKey)).digest('hex');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: '${modelName}',
    requiredAuthMethods: {
        setAuthParams: async function (api, params) {},
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            return {
                identifiers: { externalId: keyFingerprint(api.api_key), userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['api_key'],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            return {
                identifiers: { externalId: keyFingerprint(api.api_key), userId },
                details: {},
            };
        },
        testAuthRequest: async function (api) {
            return api.testAuth();
        },
    },
    env: {
        api_key: process.env.${prefix}_API_KEY,
    },
};

module.exports = { Definition };
`;
}

function readmeTemplate({ name, label, auth, apiDocsPlaceholder }) {
    const authSection =
        auth === 'oauth2'
            ? `## Authentication

${label} uses **OAuth2** (authorization_code grant). TODO: fill in the real
authorize/token URLs and required scopes once confirmed against the vendor
docs — see \`api.js\` for where they're set.

- Base URL: \`https://api.TODO-${name}.example.com/v1\` (TODO)
- Docs: ${apiDocsPlaceholder}

Set credentials locally via \`.env\`:

\`\`\`
${toEnvPrefix(name)}_CLIENT_ID=your_${name}_client_id_here
${toEnvPrefix(name)}_CLIENT_SECRET=your_${name}_client_secret_here
${toEnvPrefix(name)}_SCOPE=TODO_scopes_space_separated
REDIRECT_URI=http://localhost:3000/redirect
\`\`\`
`
            : `## Authentication

${label} uses a **static API key** (TODO: confirm the real header name — this
scaffold assumes \`x-api-key\`, no OAuth).

- Base URL: \`https://api.TODO-${name}.example.com/v1\` (TODO)
- Auth header: \`x-api-key: <your key>\` (TODO)
- Docs: ${apiDocsPlaceholder}

Set the key locally via \`.env\`:

\`\`\`
${toEnvPrefix(name)}_API_KEY=your_${name}_api_key_here
\`\`\`
`;

    return `# ${label} API Module

A [Frigg](https://friggframework.org) API module for **${label}**. TODO:
one or two sentences on what this module lets a Frigg app read and write.

${authSection}
## Usage

\`\`\`js
const { Api } = require('@friggframework/api-module-${name}');

const client = new Api({ /* TODO: api_key or OAuth2 params */ });

// TODO: replace with a real call once listItems() is renamed to a real
// ${label} endpoint.
const items = await client.listItems();
\`\`\`

## Methods

| Method | Endpoint | Notes |
|---|---|---|
| \`listItems()\` | \`GET /items\` | TODO — placeholder example method, replace with a real ${label} endpoint |
| \`testAuth()\` | — | Lightweight authenticated request used by \`definition.js\`'s \`testAuthRequest\` |

TODO: add a row per method as you implement the rest of the module against
\`${name}.openapi.yaml\`.

## OpenAPI spec

\`${name}.openapi.yaml\` in this package is the canonical machine-readable
contract for this module (TODO: replace this generated stub with one authored
from ${label}'s real API docs — one path/operationId per method in \`api.js\`).
The client in \`api.js\` mirrors it 1:1 (one method per \`operationId\`). A test
in \`tests/spec-sync.test.js\` asserts the two stay in sync. See
\`packages/v1-ready/reevo/reevo.openapi.yaml\` for a fully worked example
authored against a vendor with no published spec of its own.

## Testing

\`\`\`
npm test
\`\`\`

Tests are fully offline — the API surface is exercised against captured
requests and the auth/definition wiring against stubs (no live ${label}
credentials required).
`;
}

function openapiYamlTemplate({ name, label, auth }) {
    const securityBlock =
        auth === 'oauth2'
            ? `security:
  - OAuth2Auth: []`
            : `security:
  - ApiKeyAuth: []`;

    const securitySchemeBlock =
        auth === 'oauth2'
            ? `  securitySchemes:
    OAuth2Auth:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://TODO-${name}.example.com/oauth/authorize
          tokenUrl: https://api.TODO-${name}.example.com/oauth/token
          scopes:
            read: Read access
            write: Write access`
            : `  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: x-api-key`;

    return `openapi: 3.0.3
info:
  title: ${label} API
  version: "1.0.0"
  description: >-
    TODO: describe the ${label} public API surface and link to its real docs.
    This spec is the canonical machine-readable contract for
    @friggframework/api-module-${name} — the hand-written client in api.js
    mirrors it 1:1. See packages/v1-ready/reevo/reevo.openapi.yaml for a fully
    worked example authored from a vendor's help docs with no published spec.
  contact:
    name: Left Hook
    url: https://lefthook.com
servers:
  - url: https://api.TODO-${name}.example.com/v1
    description: ${label} API (TODO)
${securityBlock}
tags:
  - name: Items
paths:
  /items:
    get:
      tags: [Items]
      operationId: listItems
      summary: TODO — placeholder example path, replace with a real ${label} endpoint
      responses:
        "200": { $ref: "#/components/responses/ListResponse" }
        "401": { $ref: "#/components/responses/Unauthorized" }
  # TODO: add one path per api.js method, one operationId per method name —
  # tests/spec-sync.test.js will fail loudly if they drift.
components:
${securitySchemeBlock}
  responses:
    ObjectResponse:
      description: A single object.
      content:
        application/json:
          schema: { type: object, additionalProperties: true }
    ListResponse:
      description: A list of matching objects.
      content:
        application/json:
          schema:
            type: object
            additionalProperties: true
    Unauthorized:
      description: Missing or invalid credentials.
    NotFound:
      description: Object not found.
`;
}

function apiTestJsTemplate({ label, auth }) {
    if (auth === 'oauth2') {
        return `const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'client-id',
        client_secret: 'client-secret',
        redirect_uri: 'https://example.com/redirect',
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        ...overrides,
    });
    // Capture requests instead of hitting the network.
    api.sent = [];
    const record = (method) => async (options) => {
        api.sent.push({ method, ...options });
        return { ok: true };
    };
    api._get = record('GET');
    api._post = record('POST');
    api._patch = record('PATCH');
    api._delete = record('DELETE');
    return api;
}

describe('${label} Api', () => {
    describe('auth', () => {
        it('injects a Bearer token into request headers via addAuthHeaders', async () => {
            const api = makeApi();
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer test-access-token');
        });

        it('reports NOT authenticated until token expirations are set', () => {
            // OAuth2Requester.isAuthenticated() also requires
            // accessTokenExpire/refreshTokenExpire, which only setTokens() sets.
            expect(makeApi().isAuthenticated()).toBe(false);
        });

        it('builds an authorization URL from client_id/redirect_uri', () => {
            const api = new Api({
                client_id: 'client-id',
                redirect_uri: 'https://example.com/redirect',
                scope: 'read write',
            });
            expect(api.authorizationUri).toContain('client_id=client-id');
            expect(api.authorizationUri).toContain(
                'redirect_uri=https://example.com/redirect'
            );
        });
    });

    describe('endpoints', () => {
        it('listItems gets /items', async () => {
            const api = makeApi();
            await api.listItems();
            expect(api.sent[0].method).toBe('GET');
            expect(api.sent[0].url).toBe(api.baseUrl + '/items');
        });

        it('testAuth performs a lightweight authenticated request', async () => {
            const api = makeApi();
            await api.testAuth();
            expect(api.sent[0]).toBeDefined();
        });
    });

    describe('getAuthorizationRequirements', () => {
        it('declares an oauth2 requirement with an authorization url', () => {
            const api = new Api({
                client_id: 'client-id',
                redirect_uri: 'https://example.com/redirect',
            });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toBe(api.authorizationUri);
        });
    });
});
`;
    }

    return `const { Api } = require('../api');

function makeApi() {
    const api = new Api({ api_key: 'test-key-123' });
    // Capture requests instead of hitting the network.
    api.sent = [];
    const record = (method) => async (options) => {
        api.sent.push({ method, ...options });
        return { ok: true };
    };
    api._get = record('GET');
    api._post = record('POST');
    api._patch = record('PATCH');
    api._delete = record('DELETE');
    return api;
}

describe('${label} Api', () => {
    describe('auth', () => {
        it('uses the x-api-key header name', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.api_key_name).toBe('x-api-key');
            expect(api.api_key).toBe('abc');
        });

        it('injects the api key into request headers via addAuthHeaders', async () => {
            const api = new Api({ api_key: 'abc' });
            const headers = await api.addAuthHeaders({});
            expect(headers['x-api-key']).toBe('abc');
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ api_key: 'abc' }).isAuthenticated()).toBe(true);
            expect(new Api({ api_key: '' }).isAuthenticated()).toBe(false);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('endpoints', () => {
        it('listItems gets /items', async () => {
            const api = makeApi();
            await api.listItems();
            expect(api.sent[0].method).toBe('GET');
            expect(api.sent[0].url).toBe(api.baseUrl + '/items');
        });

        it('testAuth performs a lightweight authenticated request', async () => {
            const api = makeApi();
            await api.testAuth();
            expect(api.sent[0]).toBeDefined();
        });
    });

    describe('getAuthorizationRequirements', () => {
        it('declares an apiKey requirement for api_key', () => {
            const api = new Api({ api_key: 'abc' });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('apiKey');
            expect(reqs.data.jsonSchema.required).toContain('api_key');
        });
    });
});
`;
}

function definitionTestJsTemplate({ label, name, modelName, auth }) {
    if (auth === 'oauth2') {
        return `const { Definition } = require('../definition');

const { requiredAuthMethods } = Definition;

describe('${label} Definition', () => {
    it('is named ${name} and models the ${modelName} entity', () => {
        expect(Definition.getName()).toBe('${name}');
        expect(Definition.moduleName).toBe('${name}');
        expect(Definition.modelName).toBe('${modelName}');
    });

    it('persists access_token and refresh_token on the credential', () => {
        expect(requiredAuthMethods.apiPropertiesToPersist.credential).toContain(
            'access_token'
        );
        expect(requiredAuthMethods.apiPropertiesToPersist.credential).toContain(
            'refresh_token'
        );
    });

    describe('getToken', () => {
        it('exchanges an authorization code via the api', async () => {
            let receivedCode;
            const api = {
                getTokenFromCode: async (code) => {
                    receivedCode = code;
                    return { access_token: 'tok' };
                },
            };
            const result = await requiredAuthMethods.getToken(api, {
                data: { code: 'auth-code-123' },
            });
            expect(receivedCode).toBe('auth-code-123');
            expect(result).toEqual({ access_token: 'tok' });
        });
    });

    describe('entity/credential identity', () => {
        it('derives the same externalId for entity and credential from the api profile', async () => {
            const api = { testAuth: async () => ({ id: 'vendor-user-1' }) };
            const entity = await requiredAuthMethods.getEntityDetails(
                api,
                {},
                {},
                'user-1'
            );
            const credential = await requiredAuthMethods.getCredentialDetails(
                api,
                'user-1'
            );
            expect(entity.identifiers.externalId).toBe('vendor-user-1');
            expect(credential.identifiers.externalId).toBe('vendor-user-1');
        });

        it('falls back to userId when the api has no profile id', async () => {
            const api = { testAuth: async () => ({}) };
            const entity = await requiredAuthMethods.getEntityDetails(
                api,
                {},
                {},
                'user-1'
            );
            expect(entity.identifiers.externalId).toBe('user-1');
        });
    });

    describe('testAuthRequest', () => {
        it('delegates to the api testAuth check', async () => {
            let called = false;
            const api = {
                testAuth: async () => {
                    called = true;
                    return { ok: true };
                },
            };
            await expect(
                requiredAuthMethods.testAuthRequest(api)
            ).resolves.toEqual({ ok: true });
            expect(called).toBe(true);
        });

        it('propagates auth failures from the api', async () => {
            const api = {
                testAuth: async () => {
                    throw new Error('401 Unauthorized');
                },
            };
            await expect(
                requiredAuthMethods.testAuthRequest(api)
            ).rejects.toThrow(/401/);
        });
    });
});
`;
    }

    return `const { Definition } = require('../definition');

const { requiredAuthMethods } = Definition;

describe('${label} Definition', () => {
    it('is named ${name} and models the ${modelName} entity', () => {
        expect(Definition.getName()).toBe('${name}');
        expect(Definition.moduleName).toBe('${name}');
        expect(Definition.modelName).toBe('${modelName}');
    });

    it('persists the api_key on the credential', () => {
        expect(requiredAuthMethods.apiPropertiesToPersist.credential).toContain(
            'api_key'
        );
    });

    describe('key fingerprinting', () => {
        it('derives a stable, non-reversible externalId from the api key', async () => {
            const api = { api_key: 'secret-key' };
            const entity = await requiredAuthMethods.getEntityDetails(
                api,
                {},
                {},
                'user-1'
            );
            const credential = await requiredAuthMethods.getCredentialDetails(
                api,
                'user-1'
            );

            // Same key -> same id (idempotent linkage).
            expect(entity.identifiers.externalId).toBe(
                credential.identifiers.externalId
            );
            // Never the raw key.
            expect(entity.identifiers.externalId).not.toBe('secret-key');
            // sha256 hex.
            expect(entity.identifiers.externalId).toMatch(/^[a-f0-9]{64}$/);
            expect(entity.identifiers.userId).toBe('user-1');
        });

        it('produces different ids for different keys', async () => {
            const a = await requiredAuthMethods.getEntityDetails(
                { api_key: 'key-a' },
                {},
                {},
                'u'
            );
            const b = await requiredAuthMethods.getEntityDetails(
                { api_key: 'key-b' },
                {},
                {},
                'u'
            );
            expect(a.identifiers.externalId).not.toBe(b.identifiers.externalId);
        });
    });

    describe('testAuthRequest', () => {
        it('delegates to the api testAuth check', async () => {
            let called = false;
            const api = {
                testAuth: async () => {
                    called = true;
                    return { ok: true };
                },
            };
            await expect(
                requiredAuthMethods.testAuthRequest(api)
            ).resolves.toEqual({ ok: true });
            expect(called).toBe(true);
        });

        it('propagates auth failures from the api', async () => {
            const api = {
                testAuth: async () => {
                    throw new Error('401 Unauthorized');
                },
            };
            await expect(
                requiredAuthMethods.testAuthRequest(api)
            ).rejects.toThrow(/401/);
        });
    });
});
`;
}

function specSyncTestJsTemplate({ name, auth }) {
    const constructApi =
        auth === 'oauth2'
            ? `new Api({ client_id: 'x', redirect_uri: 'https://example.com/redirect' })`
            : `new Api({ api_key: 'x' })`;

    const securityTest =
        auth === 'oauth2'
            ? `    it('declares oauth2 security', () => {
        const scheme = spec.components.securitySchemes.OAuth2Auth;
        expect(scheme.type).toBe('oauth2');
    });`
            : `    it('declares x-api-key apiKey security', () => {
        const scheme = spec.components.securitySchemes.ApiKeyAuth;
        expect(scheme.type).toBe('apiKey');
        expect(scheme.in).toBe('header');
        expect(scheme.name).toBe('x-api-key');
    });`;

    return `const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', '${name}.openapi.yaml'), 'utf8')
);

const specOperationIds = Object.values(spec.paths).flatMap((item) =>
    Object.entries(item)
        .filter(([m]) => ['get', 'post', 'patch', 'put', 'delete'].includes(m))
        .map(([, op]) => op.operationId)
);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

describe('OpenAPI spec \\u2194 client sync', () => {
    it('every operationId has a matching client method', () => {
        const missing = specOperationIds.filter((op) => !clientMethods.includes(op));
        expect(missing).toEqual([]);
    });

    it('the base server URL matches the client baseUrl', () => {
        const api = ${constructApi};
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

${securityTest}
});
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
    const { name, auth, label: labelArg, category } = parseArgs(
        process.argv.slice(2)
    );

    assertValidName(name);

    if (auth !== 'apikey' && auth !== 'oauth2') {
        usageAndExit('--auth must be "apikey" or "oauth2"');
    }

    const label = labelArg || toDefaultLabel(name);
    const modelName = toModelName(name);
    const categories = category
        ? category.split(',').map((c) => c.trim()).filter(Boolean)
        : ['Other'];
    const apiDocsPlaceholder = `https://TODO-${name}-api-docs.example.com`;

    const targetDir = path.join(REPO_ROOT, 'packages', 'v1-ready', name);

    if (fs.existsSync(targetDir)) {
        console.error(
            `Error: ${path.relative(REPO_ROOT, targetDir)} already exists — refusing to overwrite.`
        );
        process.exit(1);
    }

    const ctx = { name, label, auth, categories, modelName, apiDocsPlaceholder };

    const files = {
        'index.js': indexJsTemplate(),
        'api.js': apiJsTemplate(ctx),
        'definition.js': definitionJsTemplate(ctx),
        'defaultConfig.json': defaultConfigTemplate(ctx),
        'package.json': packageJsonTemplate(ctx),
        'LICENSE.md': licenseTemplate(),
        '.env.example': envExampleTemplate(ctx),
        'README.md': readmeTemplate(ctx),
        [`${name}.openapi.yaml`]: openapiYamlTemplate(ctx),
        'tests/api.test.js': apiTestJsTemplate(ctx),
        'tests/definition.test.js': definitionTestJsTemplate(ctx),
        'tests/spec-sync.test.js': specSyncTestJsTemplate(ctx),
    };

    for (const [relPath, contents] of Object.entries(files)) {
        writeFile(path.join(targetDir, relPath), contents);
    }

    console.log(
        `Scaffolded ${path.relative(REPO_ROOT, targetDir)} (auth=${auth}, label="${label}", categories=[${categories.join(', ')}])`
    );
    console.log('Files created:');
    for (const relPath of Object.keys(files)) {
        console.log(`  ${path.join('packages/v1-ready', name, relPath)}`);
    }
    console.log('');
    console.log('Next steps:');
    console.log(
        `  1. Author the real ${name}.openapi.yaml from the vendor's API docs.`
    );
    console.log(
        '  2. Implement api.js methods 1:1 against operationIds (replace listItems()).'
    );
    console.log(
        `  3. cd packages/v1-ready/${name} && npm install && npm test`
    );
    console.log('  4. See docs/prospect-module-runbook.md for publish + demo steps.');
}

main();
