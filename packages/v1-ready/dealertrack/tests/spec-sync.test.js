const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api, BASE_URL } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'dealertrack.openapi.yaml'),
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
        expect(spec.servers[0].url).toBe(BASE_URL);
    });

    it('declares OAuth2 security matching the client token/authorize hosts', () => {
        const scheme = spec.components.securitySchemes.OAuth2;
        expect(scheme.type).toBe('oauth2');
        expect(scheme.flows.authorizationCode.authorizationUrl).toBe(
            'https://auth.dealertrack.com/oauth/authorize'
        );
        expect(scheme.flows.authorizationCode.tokenUrl).toBe(
            'https://auth.dealertrack.com/oauth/token'
        );
        const api = new Api({ access_token: 'x' });
        expect(api.tokenUri).toBe(scheme.flows.authorizationCode.tokenUrl);
    });

    it('capability manifest methods all exist on Api', () => {
        const caps = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'dealertrack.capabilities.json'),
                'utf8'
            )
        );
        const methods = Object.values(caps.objects).flatMap((obj) =>
            (obj.operations || []).map((op) => op.method)
        );
        const missing = methods.filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });
});
