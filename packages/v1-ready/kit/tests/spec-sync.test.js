const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'kit.openapi.yaml'), 'utf8')
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

    it('declares OAuth2 and X-Kit-Api-Key security schemes', () => {
        const schemes = spec.components.securitySchemes;
        expect(schemes.OAuth2.type).toBe('oauth2');
        expect(schemes.OAuth2.flows.authorizationCode.authorizationUrl).toBe(
            'https://api.kit.com/v4/oauth/authorize'
        );
        expect(schemes.OAuth2.flows.authorizationCode.tokenUrl).toBe(
            'https://api.kit.com/v4/oauth/token'
        );
        expect(schemes.ApiKeyAuth.type).toBe('apiKey');
        expect(schemes.ApiKeyAuth.name).toBe('X-Kit-Api-Key');
    });
});
