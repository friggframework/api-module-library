const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'shopmonkey.openapi.yaml'),
        'utf8'
    )
);

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'shopmonkey.capabilities.json'),
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

const NON_OPERATION_METHODS = new Set([
    'constructor',
    'addAuthHeaders',
    'setApiKey',
]);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

const apiOperationMethods = clientMethods.filter(
    (m) => !NON_OPERATION_METHODS.has(m)
);

describe('OpenAPI spec ↔ client sync', () => {
    it('every operationId has a matching client method', () => {
        const missing = specOperationIds.filter(
            (op) => !clientMethods.includes(op)
        );
        expect(missing).toEqual([]);
    });

    it('every Api operation method is declared in the OpenAPI spec', () => {
        const undeclared = apiOperationMethods.filter(
            (m) => !specOperationIds.includes(m)
        );
        expect(undeclared).toEqual([]);
    });

    it('the base server URL matches the client baseUrl', () => {
        const api = new Api({ api_key: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares BearerAuth http security matching Authorization Bearer', async () => {
        const scheme = spec.components.securitySchemes.BearerAuth;
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('bearer');
        const api = new Api({ api_key: 'x' });
        expect(api.api_key_name).toBe('Authorization');
        const headers = await api.addAuthHeaders({});
        expect(headers.Authorization).toBe('Bearer x');
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for module shopmonkey', () => {
        expect(capabilities.$schema).toMatch(/capability-manifest\/v0\.1/);
        expect(capabilities.module).toBe('shopmonkey');
        expect(capabilities.package).toBe(
            '@friggframework/api-module-shopmonkey'
        );
        expect(capabilities.version).toBe('1.0.0');
        expect(capabilities.auth).toBe('apiKey');
    });

    it('every capability method maps to a real Api method', () => {
        const missing = Object.values(capabilities.capabilities)
            .map((c) => c.method)
            .filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });

    it('objects declare fields with tags where applicable', () => {
        expect(capabilities.objects.customer.fields.length).toBeGreaterThan(0);
        expect(
            capabilities.objects.customer.fields.some((f) => f.tag)
        ).toBe(true);
        expect(capabilities.objects.order.fields.some((f) => f.tag)).toBe(
            true
        );
    });
});
