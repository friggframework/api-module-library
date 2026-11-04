const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'rollworks.openapi.yaml'),
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
            redirect_uri: 'https://example.com/r',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares OAuth2 authorizationCode security matching NextRoll', () => {
        const scheme = spec.components.securitySchemes.OAuth2;
        expect(scheme.type).toBe('oauth2');
        expect(scheme.flows.authorizationCode.authorizationUrl).toBe(
            'https://services.adroll.com/auth/authorize'
        );
        expect(scheme.flows.authorizationCode.tokenUrl).toBe(
            'https://services.adroll.com/auth/token'
        );
        expect(scheme.flows.authorizationCode.scopes).toHaveProperty('all');
    });

    it('every capability method in the manifest exists on Api', () => {
        const manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'rollworks.capabilities.json'),
                'utf8'
            )
        );
        const missing = Object.values(manifest.capabilities)
            .map((cap) => cap.method)
            .filter((method) => !clientMethods.includes(method));
        expect(missing).toEqual([]);
    });
});
