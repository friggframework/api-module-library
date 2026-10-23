const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'opendental.openapi.yaml'),
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
            developerKey: 'x',
            customerKey: 'y',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares ODFHIR Authorization apiKey security matching the client', () => {
        const scheme = spec.components.securitySchemes.OdfhirAuth;
        const api = new Api({ developerKey: 'x', customerKey: 'y' });
        expect(scheme.type).toBe('apiKey');
        expect(scheme.in).toBe('header');
        expect(scheme.name).toBe('Authorization');
        expect(scheme.name).toBe(api.api_key_name);
        expect(api.api_key).toBe('ODFHIR x/y');
    });
});

describe('Capability manifest ↔ client sync', () => {
    const manifest = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, '..', 'opendental.capabilities.json'),
            'utf8'
        )
    );

    it('is capability-manifest/v0.1 shaped for this package', () => {
        expect(manifest.$schema).toContain('capability-manifest/v0.1');
        expect(manifest.module).toBe('opendental');
        expect(manifest.package).toBe(
            '@friggframework/api-module-opendental'
        );
        expect(manifest.version).toBe(require('../package.json').version);
        expect(manifest.auth).toBe('apiKey');
    });

    it('every capability method maps to an Api method', () => {
        const missing = Object.values(manifest.capabilities)
            .map((c) => c.method)
            .filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });
});
