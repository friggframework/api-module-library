const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'revio.openapi.yaml'), 'utf8')
);

const specOperationIds = Object.values(spec.paths).flatMap((item) =>
    Object.entries(item)
        .filter(([m]) => ['get', 'post', 'patch', 'put', 'delete'].includes(m))
        .map(([, op]) => op.operationId)
);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'revio.capabilities.json'),
        'utf8'
    )
);

describe('OpenAPI spec ↔ client sync', () => {
    it('every operationId has a matching client method', () => {
        const missing = specOperationIds.filter(
            (op) => !clientMethods.includes(op)
        );
        expect(missing).toEqual([]);
    });

    it('the base server URL matches the client baseUrl', () => {
        const api = new Api({
            username: 'u',
            password: 'p',
            client_code: 'c',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares HTTP Basic security matching the client', () => {
        const scheme = spec.components.securitySchemes.BasicAuth;
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('basic');
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for the revio package at this version', () => {
        expect(capabilities.module).toBe('revio');
        expect(capabilities.package).toBe('@friggframework/api-module-revio');
        expect(capabilities.version).toBe('1.0.0');
        expect(capabilities.auth).toBe('basic');
        expect(capabilities.$schema).toContain('capability-manifest/v0.1');
    });

    it('every capability method exists on Api', () => {
        const missing = Object.entries(capabilities.capabilities)
            .map(([name, cap]) => ({ name, method: cap.method }))
            .filter(({ method }) => !clientMethods.includes(method));
        expect(missing).toEqual([]);
    });
});
