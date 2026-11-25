const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api, PRODUCTION_BASE_URL } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'ringcentral.openapi.yaml'),
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
        const api = new Api({ access_token: 'x', refresh_token: 'y' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
        expect(spec.servers[0].url).toBe(PRODUCTION_BASE_URL);
    });

    it('declares OAuth2 authorizationCode security matching RingCentral', () => {
        const scheme = spec.components.securitySchemes.OAuth2;
        expect(scheme.type).toBe('oauth2');
        expect(scheme.flows.authorizationCode.authorizationUrl).toContain(
            '/restapi/oauth/authorize'
        );
        expect(scheme.flows.authorizationCode.tokenUrl).toContain(
            '/restapi/oauth/token'
        );
        expect(
            scheme.flows.authorizationCode.scopes.ReadAccounts
        ).toBeTruthy();
    });

    it('covers core auth, business, and subscription operationIds', () => {
        for (const op of [
            'readAccountInfo',
            'listExtensions',
            'readExtension',
            'listMessages',
            'createSMSMessage',
            'readUserCallLog',
            'listContacts',
            'createSubscription',
            'deleteSubscription',
            'renewSubscription',
        ]) {
            expect(specOperationIds).toContain(op);
            expect(clientMethods).toContain(op);
        }
    });
});
