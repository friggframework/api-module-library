const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');
const capabilities = require('../hubspot.capabilities.json');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'hubspot.openapi.yaml'), 'utf8')
);

const specOperationIds = Object.values(spec.paths).flatMap((item) =>
    Object.entries(item)
        .filter(([m]) => ['get', 'post', 'patch', 'put', 'delete'].includes(m))
        .map(([, op]) => op.operationId)
        .filter(Boolean)
);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

const LEGACY_VERSION_RE = /\/(v[1-4]|crm\/v[1-4]|oauth\/v[1-4]|owners\/v[1-4]|contacts\/v[1-4]|deals\/v[1-4]|content\/api\/v[1-4]|integrations\/v[1-4])\b/;

describe('OpenAPI spec ↔ client sync', () => {
    it('pins HubSpot API version 2026-09 (not unpinned/latest)', () => {
        expect(Api.API_VERSION).toBe('2026-09');
        expect(spec.info.version).toBe('2026-09');
        expect(spec['x-frigg-api-version']).toBe('2026-09');
        expect(capabilities.apiVersion).toBe('2026-09');
        expect(capabilities.apiVersionPinned).toBe(true);
    });

    it('every operationId has a matching client method', () => {
        const missing = specOperationIds.filter((op) => !clientMethods.includes(op));
        expect(missing).toEqual([]);
    });

    it('the base server URL matches the client baseUrl', () => {
        const api = new Api({});
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares OAuth2 security with the dated token URL', () => {
        const scheme = spec.components.securitySchemes.OAuth2;
        expect(scheme.type).toBe('oauth2');
        expect(scheme.flows.authorizationCode.tokenUrl).toBe(
            'https://api.hubapi.com/oauth/2026-09/token'
        );
    });

    it('client URL map contains no legacy v1–v4 path segments', () => {
        const api = new Api({});
        const paths = [];
        for (const [key, value] of Object.entries(api.URLs)) {
            if (typeof value === 'string') {
                paths.push(`${key}:${value}`);
            } else if (typeof value === 'function') {
                // Probe with placeholder args
                const arity = value.length;
                const args = Array.from({ length: arity }, (_, i) => `arg${i}`);
                paths.push(`${key}:${value(...args)}`);
            }
        }
        const legacy = paths.filter((p) => LEGACY_VERSION_RE.test(p));
        expect(legacy).toEqual([]);
    });

    it('capabilities manifest points at dated OpenAPI paths', () => {
        for (const [name, cap] of Object.entries(capabilities.capabilities)) {
            if (cap.spec && cap.spec.kind === 'openapi') {
                expect(cap.spec.ref).toContain('2026-09');
                expect(cap.spec.ref).toMatch(/hubspot\.openapi\.yaml/);
            }
            expect(name).toBeTruthy();
        }
    });

    it('Definition.capabilities is wired to the manifest', () => {
        const { Definition } = require('../definition');
        expect(Definition.capabilities).toBe(capabilities.capabilities);
        expect(Definition.apiVersion).toBe('2026-09');
    });
});
