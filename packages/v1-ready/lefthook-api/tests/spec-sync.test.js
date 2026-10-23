const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'lefthook-api.openapi.yaml'),
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
        const api = new Api({ api_key: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares Bearer http security matching the client Authorization header', () => {
        const scheme = spec.components.securitySchemes.BearerAuth;
        const api = new Api({ api_key: 'x' });
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('bearer');
        expect(api.api_key_name).toBe('Authorization');
    });

    it('capability manifest methods all exist on Api', () => {
        const caps = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'lefthook-api.capabilities.json'),
                'utf8'
            )
        );
        expect(caps.$schema).toMatch(/capability-manifest\/v0\.1/);
        expect(caps.module).toBe('lefthook-api');
        expect(caps.package).toBe('@friggframework/api-module-lefthook-api');
        expect(caps.version).toBe('1.0.0');

        const methods = [];
        for (const obj of Object.values(caps.objects || {})) {
            for (const op of obj.operations || []) {
                methods.push(op.method);
            }
        }
        const missing = methods.filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });
});
