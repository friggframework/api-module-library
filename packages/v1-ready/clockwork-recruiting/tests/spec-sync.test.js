const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'clockwork-recruiting.openapi.yaml'),
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
            access_token: 'x',
            firm_subdomain: 'example',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares OAuth2 authorizationCode security matching the client', () => {
        const scheme = spec.components.securitySchemes.OAuth2;
        expect(scheme.type).toBe('oauth2');
        expect(scheme.flows.authorizationCode.authorizationUrl).toBe(
            'https://account.clockworkrecruiting.com/oauth/authorize'
        );
        expect(scheme.flows.authorizationCode.tokenUrl).toBe(
            'https://account.clockworkrecruiting.com/oauth/token'
        );
        expect(scheme.flows.authorizationCode.scopes).toHaveProperty('read');
        expect(scheme.flows.authorizationCode.scopes).toHaveProperty('write');
    });
});
