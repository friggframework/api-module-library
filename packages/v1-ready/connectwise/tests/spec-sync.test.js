const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const {Api, DEFAULT_SITE, DEFAULT_API_VERSION} = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'connectwise.openapi.yaml'),
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
            company_id: 'x',
            public_key: 'x',
            private_key: 'x',
            client_id: 'x',
            site: DEFAULT_SITE,
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
        expect(api.baseUrl).toBe(DEFAULT_SITE);
    });

    it('declares Basic auth, clientId, and Accept version matching the client', async () => {
        const basic = spec.components.securitySchemes.BasicAuth;
        expect(basic.type).toBe('http');
        expect(basic.scheme).toBe('basic');

        const clientIdScheme = spec.components.securitySchemes.ClientIdHeader;
        expect(clientIdScheme.type).toBe('apiKey');
        expect(clientIdScheme.in).toBe('header');
        expect(clientIdScheme.name).toBe('clientId');

        const accept = spec.components.parameters.AcceptHeader;
        expect(accept.name).toBe('Accept');
        expect(accept.in).toBe('header');
        expect(accept.schema.default).toBe(
            `application/vnd.connectwise.com+json; version=${DEFAULT_API_VERSION}`
        );

        const api = new Api({
            company_id: 'acme',
            public_key: 'pub',
            private_key: 'priv',
            client_id: 'client-123',
            site: DEFAULT_SITE,
        });
        const headers = await api.addAuthHeaders({});
        expect(headers.clientId).toBe('client-123');
        expect(headers.Accept).toBe(accept.schema.default);
        expect(headers.authorization).toMatch(/^Basic /);
    });
});

describe('capability manifest ↔ client sync', () => {
    const manifest = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, '..', 'connectwise.capabilities.json'),
            'utf8'
        )
    );

    it('is capability-manifest/v0.1 for module connectwise at package version', () => {
        const pkg = require('../package.json');
        expect(manifest.$schema).toContain('capability-manifest/v0.1');
        expect(manifest.module).toBe('connectwise');
        expect(manifest.package).toBe('@friggframework/api-module-connectwise');
        expect(manifest.version).toBe(pkg.version);
        expect(manifest.auth).toBe('basic');
    });

    it('every capability method maps to a real Api method', () => {
        const missing = Object.entries(manifest.capabilities)
            .filter(([, cap]) => !clientMethods.includes(cap.method))
            .map(([name, cap]) => `${name} -> ${cap.method}`);
        expect(missing).toEqual([]);
    });

    it('every OpenAPI operationId is covered by a capability method', () => {
        const capabilityMethods = new Set(
            Object.values(manifest.capabilities).map((c) => c.method)
        );
        const missing = specOperationIds.filter(
            (op) => !capabilityMethods.has(op)
        );
        expect(missing).toEqual([]);
    });
});
