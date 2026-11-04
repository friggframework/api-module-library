const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api, DEFAULT_API_BASE } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'digitail.openapi.yaml'),
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
        const api = new Api({
            client_id: 'x',
            client_secret: 'y',
            redirect_uri: 'https://x/digitail',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
        expect(spec.servers[0].url).toBe(DEFAULT_API_BASE);
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
            path.join(__dirname, '..', 'digitail.capabilities.json'),
            'utf8'
        )
    );

    it('is capability-manifest/v0.1 shaped for this package', () => {
        expect(manifest.$schema).toContain('capability-manifest/v0.1');
        expect(manifest.module).toBe('digitail');
        expect(manifest.package).toBe('@friggframework/api-module-digitail');
        expect(manifest.version).toBe(require('../package.json').version);
        expect(manifest.auth).toBe('oauth2');
    });

    it('every capability method maps to an Api method', () => {
        const missing = Object.values(manifest.capabilities)
            .map((c) => c.method)
            .filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });

    it('objects declare fields arrays', () => {
        for (const [name, obj] of Object.entries(manifest.objects)) {
            expect(Array.isArray(obj.fields)).toBe(true);
            expect(obj.fields.length).toBeGreaterThan(0);
            expect(obj.label).toBeTruthy();
            expect(name).toBeTruthy();
        }
    });
});

describe('ADR-057 mappings', () => {
    const { extensions } = require('../index');

    it('exposes UNVALIDATED business and billing mappings', () => {
        expect(extensions.mapping.schemas.business.validation).toBe(
            'UNVALIDATED'
        );
        expect(extensions.mapping.schemas.business.schema).toBe('business@1');
        expect(extensions.mapping.schemas.billing.validation).toBe(
            'UNVALIDATED'
        );
        expect(extensions.mapping.schemas.billing.schema).toBe('billing@1');
        expect(extensions.mapping.schemas.business.objects.clinic).toBeDefined();
        expect(
            extensions.mapping.schemas.business.objects.petParent
        ).toBeDefined();
        expect(
            extensions.mapping.schemas.billing.objects.invoice
        ).toBeDefined();
    });

    it('does not invent mappings for pets or appointments', () => {
        expect(
            extensions.mapping.schemas.business.objects.pet
        ).toBeUndefined();
        expect(
            extensions.mapping.schemas.business.objects.appointment
        ).toBeUndefined();
    });
});
