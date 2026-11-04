const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'netx.openapi.yaml'), 'utf8')
);

const manifest = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'netx.capabilities.json'),
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
        const api = new Api({});
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares apiToken Authorization security matching the client', async () => {
        const scheme = spec.components.securitySchemes.ApiTokenAuth;
        const api = new Api({ access_token: 'x' });
        expect(scheme.type).toBe('apiKey');
        expect(scheme.in).toBe('header');
        expect(scheme.name).toBe('Authorization');
        const headers = await api.addAuthHeaders({});
        expect(headers.Authorization).toBe('apiToken x');
        expect(scheme.description).toMatch(/apiToken/);
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for this package version', () => {
        expect(manifest.$schema).toContain('capability-manifest/v0.1');
        expect(manifest.module).toBe('netx');
        expect(manifest.package).toBe('@friggframework/api-module-netx');
        expect(manifest.version).toBe(
            require('../package.json').version
        );
        expect(manifest.auth).toBe('oauth2');
    });

    it('every capability method exists on Api', () => {
        const methods = Object.values(manifest.capabilities).map((c) => c.method);
        const missing = methods.filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });

    it('objects declare fields with tags where applicable', () => {
        expect(manifest.objects.asset.fields.some((f) => f.tag)).toBe(true);
        expect(manifest.objects.folder.fields.some((f) => f.tag)).toBe(true);
        expect(manifest.objects.user.fields.some((f) => f.tag)).toBe(true);
    });
});
