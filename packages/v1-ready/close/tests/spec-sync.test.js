const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'close.openapi.yaml'), 'utf8')
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

    it('declares ApiKeyAuth basic and OAuth2 security schemes', () => {
        const schemes = spec.components.securitySchemes;
        expect(schemes.ApiKeyAuth.type).toBe('http');
        expect(schemes.ApiKeyAuth.scheme).toBe('basic');
        expect(schemes.OAuth2.type).toBe('oauth2');
        expect(
            schemes.OAuth2.flows.authorizationCode.authorizationUrl
        ).toContain('app.close.com/oauth2/authorize');
        expect(schemes.OAuth2.flows.authorizationCode.tokenUrl).toBe(
            'https://api.close.com/oauth2/token/'
        );
    });
});
