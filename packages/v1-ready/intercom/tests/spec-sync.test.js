const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'intercom.openapi.yaml'),
        'utf8'
    )
);

const caps = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'intercom.capabilities.json'),
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

    it('declares Bearer security matching OAuth2Requester', () => {
        const scheme = spec.components.securitySchemes.BearerAuth;
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('bearer');
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for this package/version', () => {
        expect(caps.$schema).toContain('capability-manifest/v0.1');
        expect(caps.module).toBe('intercom');
        expect(caps.package).toBe('@friggframework/api-module-intercom');
        expect(caps.version).toBe(require('../package.json').version);
        expect(caps.auth).toBe('oauth2');
    });

    it('every capability method exists on Api', () => {
        const missing = Object.entries(caps.capabilities)
            .filter(([, c]) => !clientMethods.includes(c.method))
            .map(([name, c]) => `${name} → ${c.method}`);
        expect(missing).toEqual([]);
    });

    it('webhook.verify maps to verifyWebhookSignature', () => {
        expect(caps.webhook.verify).toBe('verifyWebhookSignature');
        expect(clientMethods).toContain('verifyWebhookSignature');
    });

    it('objects declare fields with optional tags', () => {
        for (const [, obj] of Object.entries(caps.objects)) {
            expect(Array.isArray(obj.fields)).toBe(true);
            expect(obj.fields.length).toBeGreaterThan(0);
        }
        const tagged = Object.values(caps.objects)
            .flatMap((o) => o.fields)
            .filter((f) => f.tag);
        expect(tagged.length).toBeGreaterThan(0);
    });
});
