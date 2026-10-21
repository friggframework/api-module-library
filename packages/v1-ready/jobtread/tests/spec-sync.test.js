const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'jobtread.openapi.yaml'), 'utf8')
);

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'jobtread.capabilities.json'),
        'utf8'
    )
);

const specOperationIds = Object.values(spec.paths).flatMap((item) =>
    Object.entries(item)
        .filter(([m]) => ['get', 'post', 'patch', 'put', 'delete'].includes(m))
        .map(([, op]) => op.operationId)
);

const NON_OPERATION_METHODS = new Set([
    'constructor',
    'pave',
    'addAuthHeaders',
    'setGrantKey',
    '_listArgs',
    '_requireOrganizationId',
]);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

const paveIssuingMethods = clientMethods.filter(
    (m) => !NON_OPERATION_METHODS.has(m)
);

describe('OpenAPI spec ↔ client sync', () => {
    it('every operationId has a matching client method', () => {
        const missing = specOperationIds.filter(
            (op) => !clientMethods.includes(op)
        );
        expect(missing).toEqual([]);
    });

    it('every Pave-issuing client method is declared in the OpenAPI spec', () => {
        const undeclared = paveIssuingMethods.filter(
            (m) => !specOperationIds.includes(m)
        );
        expect(undeclared).toEqual([]);
    });

    it('the base server URL matches the client baseUrl', () => {
        const api = new Api({ grant_key: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares GrantKeyAuth apiKey security matching body auth', () => {
        const scheme = spec.components.securitySchemes.GrantKeyAuth;
        expect(scheme.type).toBe('apiKey');
        expect(scheme.name).toBe('grantKey');
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for module jobtread', () => {
        expect(capabilities.$schema).toMatch(/capability-manifest\/v0\.1/);
        expect(capabilities.module).toBe('jobtread');
        expect(capabilities.package).toBe(
            '@friggframework/api-module-jobtread'
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
        expect(capabilities.objects.account.fields.length).toBeGreaterThan(0);
        expect(
            capabilities.objects.account.fields.some((f) => f.tag)
        ).toBe(true);
        expect(capabilities.objects.job.fields.some((f) => f.tag)).toBe(true);
    });
});
