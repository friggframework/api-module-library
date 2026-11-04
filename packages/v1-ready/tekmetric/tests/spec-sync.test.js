const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'tekmetric.openapi.yaml'),
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

    it('the base server URL matches the client baseUrl (production default)', () => {
        const prevEnv = process.env.TEKMETRIC_ENVIRONMENT;
        const prevBase = process.env.TEKMETRIC_BASE_URL;
        delete process.env.TEKMETRIC_ENVIRONMENT;
        delete process.env.TEKMETRIC_BASE_URL;
        try {
            const api = new Api({
                client_id: 'x',
                client_secret: 'y',
            });
            expect(spec.servers[0].url).toBe(
                'https://shop.tekmetric.com/api/v1'
            );
            expect(spec.servers[0].url).toBe(api.baseUrl);
        } finally {
            if (prevEnv === undefined) delete process.env.TEKMETRIC_ENVIRONMENT;
            else process.env.TEKMETRIC_ENVIRONMENT = prevEnv;
            if (prevBase === undefined) delete process.env.TEKMETRIC_BASE_URL;
            else process.env.TEKMETRIC_BASE_URL = prevBase;
        }
    });

    it('declares bearerAuth security matching the client', () => {
        const scheme = spec.components.securitySchemes.bearerAuth;
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('bearer');
    });
});

describe('Capability manifest ↔ client sync', () => {
    const manifest = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, '..', 'tekmetric.capabilities.json'),
            'utf8'
        )
    );

    it('is capability-manifest/v0.1 shaped for this package', () => {
        expect(manifest.$schema).toContain('capability-manifest/v0.1');
        expect(manifest.module).toBe('tekmetric');
        expect(manifest.package).toBe('@friggframework/api-module-tekmetric');
        expect(manifest.version).toBe(require('../package.json').version);
        expect(manifest.auth).toBe('oauth2');
    });

    it('every capability method maps to an Api method', () => {
        const missing = Object.values(manifest.capabilities)
            .map((c) => c.method)
            .filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });

    it('object field tags are present on core objects', () => {
        expect(manifest.objects.shop.fields.some((f) => f.tag)).toBe(true);
        expect(manifest.objects.customer.fields.some((f) => f.tag)).toBe(true);
    });
});
