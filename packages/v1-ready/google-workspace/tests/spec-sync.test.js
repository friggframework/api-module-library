const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'google-workspace.openapi.yaml'),
        'utf8'
    )
);

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'google-workspace.capabilities.json'),
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
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares oauth2 security matching Google authorize/token URLs', () => {
        const scheme = spec.components.securitySchemes.oauth2;
        expect(scheme.type).toBe('oauth2');
        expect(scheme.flows.authorizationCode.authorizationUrl).toBe(
            'https://accounts.google.com/o/oauth2/v2/auth'
        );
        expect(scheme.flows.authorizationCode.tokenUrl).toBe(
            'https://oauth2.googleapis.com/token'
        );
        const scopes = scheme.flows.authorizationCode.scopes;
        expect(scopes['https://www.googleapis.com/auth/drive']).toBeDefined();
        expect(
            scopes['https://www.googleapis.com/auth/calendar']
        ).toBeDefined();
        expect(
            scopes['https://www.googleapis.com/auth/userinfo.email']
        ).toBeDefined();
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for this module/package/version', () => {
        expect(capabilities.$schema).toContain('capability-manifest/v0.1');
        expect(capabilities.module).toBe('google-workspace');
        expect(capabilities.package).toBe(
            '@friggframework/api-module-google-workspace'
        );
        expect(capabilities.version).toBe('1.0.0');
        expect(capabilities.auth).toBe('oauth2');
    });

    it('every capability method maps to a real Api method', () => {
        const methods = Object.values(capabilities.capabilities).map(
            (c) => c.method
        );
        const missing = methods.filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });
});
