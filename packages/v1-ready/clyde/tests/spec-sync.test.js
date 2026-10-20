const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'clyde.openapi.yaml'), 'utf8')
);

const caps = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'clyde.capabilities.json'),
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

    it('the base server URL matches the client default baseUrl', () => {
        const api = new Api({ clientKey: 'x', secret: 'y' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares HTTP Basic auth security', () => {
        const scheme = spec.components.securitySchemes.BasicAuth;
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('basic');
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for this package', () => {
        expect(caps.$schema).toContain('capability-manifest/v0.1');
        expect(caps.module).toBe('clyde');
        expect(caps.package).toBe('@friggframework/api-module-clyde');
        expect(caps.version).toBe(
            require('../package.json').version
        );
        expect(caps.auth).toBe('basic');
    });

    it('every capability method maps to a real Api method', () => {
        const methods = Object.values(caps.capabilities).map((c) => c.method);
        const missing = methods.filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });

    it('every object field entry has a name (tags optional)', () => {
        for (const [objName, obj] of Object.entries(caps.objects)) {
            expect(Array.isArray(obj.fields)).toBe(true);
            for (const field of obj.fields) {
                expect(field.name).toBeTruthy();
                expect(typeof field.name).toBe('string');
            }
            expect(objName).toBeTruthy();
        }
    });
});
