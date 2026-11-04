const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'factorial.openapi.yaml'),
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
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://x/r',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares OAuth2 and x-api-key security matching the client', () => {
        const oauth = spec.components.securitySchemes.OAuth2;
        const apiKey = spec.components.securitySchemes.ApiKeyAuth;
        expect(oauth.type).toBe('oauth2');
        expect(oauth.flows.authorizationCode.authorizationUrl).toBe(
            'https://id.factorialhr.com/oauth/authorize'
        );
        expect(oauth.flows.authorizationCode.tokenUrl).toBe(
            'https://id.factorialhr.com/api/oauth/token'
        );
        expect(apiKey.type).toBe('apiKey');
        expect(apiKey.in).toBe('header');
        expect(apiKey.name).toBe('x-api-key');
    });

    it('capabilities methods exist on Api', () => {
        const caps = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'factorial.capabilities.json'),
                'utf8'
            )
        );
        const missing = Object.values(caps.capabilities)
            .map((c) => c.method)
            .filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });
});
