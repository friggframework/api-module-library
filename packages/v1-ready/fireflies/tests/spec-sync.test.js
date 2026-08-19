const fs = require('fs');
const path = require('path');
const { Api } = require('../api');

/**
 * GraphQL manifest <-> client sync.
 *
 * Fireflies is a single-endpoint GraphQL API, so there is no REST path surface
 * for an OpenAPI document to describe. This is the GraphQL-native equivalent of
 * the reevo.openapi.yaml + spec-sync.test.js pair used elsewhere in the library:
 * fireflies.operations.json is the canonical manifest of the operations the
 * client sends, and this test asserts the hand-written client in api.js and the
 * manifest cannot drift apart.
 *
 * It is stronger than a name-only check: it drives every client method through a
 * fake `fetch`, captures the exact request, and asserts the endpoint, the
 * `Authorization: Bearer <key>` header, and the whitespace-normalized GraphQL
 * query string all match what the manifest declares.
 */
const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'fireflies.operations.json'), 'utf8')
);

// GraphQL ignores insignificant whitespace; compare on a normalized form so the
// manifest is coupled to the operation/fields/variables, not to indentation.
const normalize = (s) => String(s).replace(/\s+/g, ' ').trim();

// Api.prototype members that are transport/config, not GraphQL operations.
const NON_OPERATION_METHODS = new Set([
    'constructor',
    'graphql', // the shared transport
    'addAuthHeaders', // auth plumbing
    'getAuthorizationRequirements', // static form descriptor, no network call
]);

// How to invoke each client method so it emits its request. Keyed by clientMethod.
const INVOKE = {
    getUser: [],
    listTranscripts: [{ limit: 1 }],
    getTranscript: ['transcript-id-1'],
    getTranscriptSummary: ['transcript-id-1'],
    searchTranscripts: ['pricing'],
};

function makeApi(captured) {
    const fakeFetch = async (url, options) => {
        captured.url = url;
        captured.options = options;
        return {
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ data: {} }),
            text: async () => JSON.stringify({ data: {} }),
        };
    };
    return new Api({ api_key: 'spec_sync_key', fetch: fakeFetch });
}

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);
const graphqlIssuingMethods = clientMethods.filter(
    (m) => !NON_OPERATION_METHODS.has(m)
);
const manifestMethods = manifest.operations.map((op) => op.clientMethod);

describe('GraphQL manifest <-> client sync', () => {
    it('every manifest operation has a matching client method', () => {
        const missing = manifestMethods.filter(
            (m) => !clientMethods.includes(m)
        );
        expect(missing).toEqual([]);
    });

    it('every GraphQL-issuing client method is declared in the manifest (1:1, no orphans)', () => {
        const undeclared = graphqlIssuingMethods.filter(
            (m) => !manifestMethods.includes(m)
        );
        expect(undeclared).toEqual([]);
    });

    it('operationId equals clientMethod for every operation', () => {
        for (const op of manifest.operations) {
            expect(op.operationId).toBe(op.clientMethod);
        }
    });

    it('the manifest endpoint matches the client baseUrl', () => {
        const api = new Api({ api_key: 'x' });
        expect(manifest.endpoint).toBe(api.baseUrl);
    });

    it('declares Bearer auth via the Authorization header', () => {
        expect(manifest.auth.type).toBe('bearer');
        expect(manifest.auth.header).toBe('Authorization');
        expect(manifest.auth.valueFormat).toBe('Bearer <api_key>');
    });

    it('every operation, when invoked, POSTs the exact query the manifest declares', async () => {
        for (const op of manifest.operations) {
            const captured = {};
            const api = makeApi(captured);
            const args = INVOKE[op.clientMethod];
            expect(args).toBeDefined(); // guard: a new method needs an INVOKE entry
            await api[op.clientMethod](...args);

            // endpoint + transport
            expect(captured.url).toBe(manifest.endpoint);
            expect(captured.options.method).toBe(manifest.transport.method);
            expect(captured.options.headers['Content-Type']).toBe(
                manifest.transport.contentType
            );

            // auth: Authorization: Bearer <key>
            expect(captured.options.headers[manifest.auth.header]).toBe(
                'Bearer spec_sync_key'
            );

            // the actual GraphQL query matches the manifest 1:1 (normalized)
            const body = JSON.parse(captured.options.body);
            expect(normalize(body.query)).toBe(normalize(op.query));
        }
    });

    it('each operation selects the fields the manifest lists', async () => {
        for (const op of manifest.operations) {
            const captured = {};
            const api = makeApi(captured);
            await api[op.clientMethod](...INVOKE[op.clientMethod]);
            const query = normalize(JSON.parse(captured.options.body).query);
            for (const field of op.selectedFields) {
                expect(query).toContain(normalize(field));
            }
        }
    });
});
