const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api, DEFAULT_BASE_URL } = require('../api');
const pkg = require('../package.json');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'donorperfect.openapi.yaml'),
        'utf8'
    )
);

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'donorperfect.capabilities.json'),
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
    'getAuthorizationRequirements',
    'rawApiKey',
    '_sleep',
    '_fetchText',
    '_buildBody',
    '_requestXml',
    '_lookupResult',
]);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

const xmlIssuingMethods = clientMethods.filter(
    (m) => !NON_OPERATION_METHODS.has(m)
);

describe('OpenAPI spec ↔ client sync', () => {
    it('every operationId has a matching client method', () => {
        const missing = specOperationIds.filter(
            (op) => !clientMethods.includes(op)
        );
        expect(missing).toEqual([]);
    });

    it('every XML-issuing client method is declared in the OpenAPI spec', () => {
        const undeclared = xmlIssuingMethods.filter(
            (m) => !specOperationIds.includes(m)
        );
        expect(undeclared).toEqual([]);
    });

    it('the base server URL matches the client baseUrl', () => {
        const api = new Api({ api_key: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
        expect(spec.servers[0].url).toBe(DEFAULT_BASE_URL);
    });

    it('declares ApiKeyAuth matching body/query apikey (not a header)', () => {
        const scheme = spec.components.securitySchemes.ApiKeyAuth;
        expect(scheme.type).toBe('apiKey');
        expect(scheme.name).toBe('apikey');
        expect(scheme.in).not.toBe('header');
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for module donorperfect', () => {
        expect(capabilities.$schema).toMatch(/capability-manifest\/v0\.1/);
        expect(capabilities.module).toBe('donorperfect');
        expect(capabilities.package).toBe(pkg.name);
        expect(capabilities.version).toBe(pkg.version);
        expect(capabilities.auth).toBe('apiKey');
    });

    it('every capability method maps to a real Api method', () => {
        const missing = Object.values(capabilities.capabilities)
            .map((c) => c.method)
            .filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });

    it('objects declare fields with tags where applicable', () => {
        expect(capabilities.objects.donor.fields.length).toBeGreaterThan(0);
        expect(
            capabilities.objects.donor.fields.some((f) => f.tag)
        ).toBe(true);
        expect(capabilities.objects.gift.fields.some((f) => f.tag)).toBe(true);
    });

    it('documents that webhooks are not offered on the public XML API', () => {
        expect(capabilities.webhook.scope).toBe('none');
        expect(Object.keys(capabilities.events || {})).toHaveLength(0);
    });
});

describe('ADR-057 mappings export', () => {
    it('exports UNVALIDATED business@1 donor→Contact/Company mappings', () => {
        const { extensions } = require('../index');
        const business = extensions.mapping.schemas.business;
        expect(business.schema).toBe('business@1');
        expect(business.validation).toBe('UNVALIDATED');
        expect(business.objects.donor.length).toBe(2);
        expect(business.objects.donor.map((b) => b.to).sort()).toEqual([
            'Company',
            'Contact',
        ]);
    });
});
