const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'attentive.openapi.yaml'),
        'utf8'
    )
);

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'attentive.capabilities.json'),
        'utf8'
    )
);

const specOperationIds = Object.values(spec.paths).flatMap((item) =>
    Object.entries(item)
        .filter(([m]) =>
            ['get', 'post', 'patch', 'put', 'delete'].includes(m)
        )
        .map(([, op]) => op.operationId)
);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

describe('OpenAPI spec ↔ client sync', () => {
    it('every operationId has a matching client method', () => {
        const missing = specOperationIds.filter(
            (op) => !clientMethods.includes(op)
        );
        expect(missing).toEqual([]);
    });

    it('the base server URL matches the client baseUrl', () => {
        const api = new Api({ access_token: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares bearerAuth security matching OAuth/API-key Bearer usage', () => {
        const scheme = spec.components.securitySchemes.bearerAuth;
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('bearer');
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for this package version', () => {
        expect(capabilities.$schema).toContain('capability-manifest/v0.1');
        expect(capabilities.module).toBe('attentive');
        expect(capabilities.package).toBe(
            '@friggframework/api-module-attentive'
        );
        expect(capabilities.version).toBe(
            require('../package.json').version
        );
        expect(capabilities.auth).toBe('oauth2');
    });

    it('every capability method exists on Api', () => {
        const methods = Object.values(capabilities.capabilities).map(
            (c) => c.method
        );
        const missing = methods.filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });

    it('webhook.verify maps to verifyWebhookSignature', () => {
        expect(capabilities.webhook.verify).toBe('verifyWebhookSignature');
        expect(clientMethods).toContain('verifyWebhookSignature');
    });
});
