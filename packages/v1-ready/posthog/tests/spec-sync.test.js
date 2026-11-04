const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');
const capabilities = require('../posthog.capabilities.json');
const { contactMapping } = require('../mappings/contact');
const pkg = require('../index');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'posthog.openapi.yaml'),
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
        const api = new Api({ api_key: 'x', project_id: '1' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares Bearer/apiKey Authorization security matching the client', () => {
        const scheme = spec.components.securitySchemes.BearerAuth;
        const api = new Api({ api_key: 'x', project_id: '1' });
        expect(scheme.type).toBe('apiKey');
        expect(scheme.in).toBe('header');
        expect(scheme.name).toBe('Authorization');
        expect(scheme.name).toBe(api.api_key_name);
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is a capability-manifest/v0.1 for this package', () => {
        expect(capabilities.$schema).toBe('capability-manifest/v0.1');
        expect(capabilities.module).toBe('posthog');
        expect(capabilities.package).toBe(
            '@friggframework/api-module-posthog'
        );
        expect(capabilities.version).toBe('1.0.0');
        expect(capabilities.auth.type).toBe('apiKey');
    });

    it('every capability operation maps to a real Api method', () => {
        const missing = capabilityMethods.filter(
            (m) => !clientMethods.includes(m)
        );
        expect(missing).toEqual([]);
    });
});

describe('ADR-057 mapping export', () => {
    it('exports UNVALIDATED person → Contact under extensions.mapping', () => {
        expect(contactMapping.schema).toBe('business@1');
        expect(contactMapping.label).toBe('UNVALIDATED');
        expect(contactMapping.objects.person[0].to).toBe('Contact');
        expect(pkg.extensions.mapping.schemas.business).toBe(contactMapping);
    });
});
