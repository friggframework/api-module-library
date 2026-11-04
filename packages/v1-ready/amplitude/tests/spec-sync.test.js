const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');
const capabilities = require('../amplitude.capabilities.json');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'amplitude.openapi.yaml'),
        'utf8'
    )
);

const specOperationIds = Object.values(spec.paths).flatMap((item) =>
    Object.entries(item)
        .filter(([m]) => ['get', 'post', 'patch', 'put', 'delete'].includes(m))
        .map(([, op]) => op.operationId)
);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

const capabilityMethods = Object.values(capabilities.objects || {}).flatMap(
    (obj) => (obj.operations || []).map((op) => op.method)
);

describe('OpenAPI spec ↔ client sync', () => {
    it('every operationId has a matching client method', () => {
        const missing = specOperationIds.filter(
            (op) => !clientMethods.includes(op)
        );
        expect(missing).toEqual([]);
    });

    it('the base server URL matches the client default baseUrl', () => {
        const api = new Api({ api_key: 'x', secret_key: 'y' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares HTTP Basic auth security', () => {
        const scheme = spec.components.securitySchemes.BasicAuth;
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('basic');
    });

    it('documents User Profile on the profile-api host', () => {
        const op = spec.paths['/v1/userprofile'].get;
        expect(op.operationId).toBe('getUserProfile');
        expect(op.servers[0].url).toBe('https://profile-api.amplitude.com');
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is a capability-manifest/v0.1 for this package', () => {
        expect(capabilities.$schema).toBe('capability-manifest/v0.1');
        expect(capabilities.module).toBe('amplitude');
        expect(capabilities.package).toBe(
            '@friggframework/api-module-amplitude'
        );
        expect(capabilities.version).toBe('1.0.0');
        expect(capabilities.auth.type).toBe('basic');
    });

    it('every capability operation maps to a real Api method', () => {
        const missing = capabilityMethods.filter(
            (m) => !clientMethods.includes(m)
        );
        expect(missing).toEqual([]);
    });
});
