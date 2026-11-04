const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api, DEFAULT_BASE_URL } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'neon.openapi.yaml'), 'utf8')
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

    it('the base server URL matches the client default baseUrl', () => {
        const api = new Api({ orgId: 'x', apiKey: 'y' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
        expect(spec.servers[0].url).toBe(DEFAULT_BASE_URL);
    });

    it('declares HTTP Basic auth security', () => {
        const scheme = spec.components.securitySchemes.BasicAuth;
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('basic');
    });

    it('capability methods all exist on Api', () => {
        const caps = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'neon.capabilities.json'),
                'utf8'
            )
        );
        const methods = Object.values(caps.capabilities).map((c) => c.method);
        const missing = methods.filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });

    it('capability manifest uses capability-manifest/v0.1 shape', () => {
        const caps = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'neon.capabilities.json'),
                'utf8'
            )
        );
        expect(caps.$schema).toContain('capability-manifest/v0.1');
        expect(caps.module).toBe('neon');
        expect(caps.package).toBe('@friggframework/api-module-neon');
        expect(caps.version).toBe('1.0.0');
        expect(caps.auth).toBe('basic');
        expect(caps.objects).toBeTruthy();
        expect(caps.capabilities).toBeTruthy();
    });
});
