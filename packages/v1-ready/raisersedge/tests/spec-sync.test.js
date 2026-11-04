const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'raisersedge.openapi.yaml'),
        'utf8'
    )
);

const caps = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'raisersedge.capabilities.json'),
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
        const api = new Api({ access_token: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares OAuth2 + Bb-Api-Subscription-Key security schemes', () => {
        const schemes = spec.components.securitySchemes;
        expect(schemes.OAuth2.type).toBe('oauth2');
        expect(
            schemes.OAuth2.flows.authorizationCode.authorizationUrl
        ).toBe('https://oauth2.sky.blackbaud.com/authorization');
        expect(schemes.OAuth2.flows.authorizationCode.tokenUrl).toBe(
            'https://oauth2.sky.blackbaud.com/token'
        );
        expect(schemes.SubscriptionKey.type).toBe('apiKey');
        expect(schemes.SubscriptionKey.name).toBe('Bb-Api-Subscription-Key');
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for raisersedge @ 1.0.0', () => {
        expect(caps.$schema).toContain('capability-manifest/v0.1');
        expect(caps.module).toBe('raisersedge');
        expect(caps.package).toBe('@friggframework/api-module-raisersedge');
        expect(caps.version).toBe('1.0.0');
        expect(caps.auth).toBe('oauth2');
    });

    it('every capability method exists on Api', () => {
        const missing = Object.entries(caps.capabilities)
            .map(([name, cap]) => ({ name, method: cap.method }))
            .filter(({ method }) => !clientMethods.includes(method));
        expect(missing).toEqual([]);
    });
});
