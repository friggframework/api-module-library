const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'bamboohr.openapi.yaml'),
        'utf8'
    )
);

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'bamboohr.capabilities.json'),
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

    it('the base server URL matches the client baseUrl template', () => {
        const api = new Api({ api_key: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
        expect(spec.servers[0].url).toBe(
            'https://{companyDomain}.bamboohr.com/api/v1'
        );
    });

    it('declares Basic auth security matching the client', () => {
        const scheme = spec.components.securitySchemes.BasicAuth;
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('basic');
        const api = new Api({ api_key: 'x', companyDomain: 'acme' });
        expect(api.username).toBe('x');
        expect(api.password).toBe('x');
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for module bamboohr', () => {
        expect(capabilities.$schema).toMatch(/capability-manifest\/v0\.1/);
        expect(capabilities.module).toBe('bamboohr');
        expect(capabilities.package).toBe(
            '@friggframework/api-module-bamboohr'
        );
        expect(capabilities.auth).toBe('apiKey');
        expect(capabilities.version).toBe('1.0.0');
    });

    it('every capability method maps to a real Api method', () => {
        const missing = Object.values(capabilities.capabilities)
            .map((cap) => cap.method)
            .filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });

    it('objects declare fields with tags where applicable', () => {
        const employeeFields = capabilities.objects.employee.fields;
        expect(employeeFields.some((f) => f.tag === 'person.email')).toBe(
            true
        );
        expect(employeeFields.some((f) => f.name === 'id')).toBe(true);
    });
});
