const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'google-analytics.openapi.yaml'),
        'utf8'
    )
);

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'google-analytics.capabilities.json'),
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
        const api = new Api({
            client_id: 'x',
            client_secret: 'y',
            redirect_uri: 'https://example.com/r',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares OAuth2 security matching Bearer auth', () => {
        const scheme = spec.components.securitySchemes.OAuth2;
        expect(scheme.type).toBe('oauth2');
        expect(scheme.flows.authorizationCode.authorizationUrl).toBe(
            'https://accounts.google.com/o/oauth2/v2/auth'
        );
        expect(scheme.flows.authorizationCode.tokenUrl).toBe(
            'https://oauth2.googleapis.com/token'
        );
        expect(
            scheme.flows.authorizationCode.scopes[
                'https://www.googleapis.com/auth/analytics.readonly'
            ]
        ).toBeTruthy();
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is schema capability-manifest/v0.1 for this package', () => {
        expect(capabilities.$schema).toBe('capability-manifest/v0.1');
        expect(capabilities.module).toBe('google-analytics');
        expect(capabilities.package).toBe(
            '@friggframework/api-module-google-analytics'
        );
        expect(capabilities.version).toBe('1.0.0');
        expect(capabilities.auth.type).toBe('oauth2');
    });

    it('every capability operation method exists on Api', () => {
        const methods = [];
        for (const obj of Object.values(capabilities.objects || {})) {
            for (const op of obj.operations || []) {
                methods.push(op.method);
            }
        }
        const missing = methods.filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });
});
