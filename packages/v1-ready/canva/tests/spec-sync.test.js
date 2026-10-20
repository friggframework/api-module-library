const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'canva.openapi.yaml'), 'utf8')
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
            client_id: 'x',
            client_secret: 'y',
            redirect_uri: 'http://localhost/canva',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares OAuth2 + Basic Auth security matching Canva authorize/token URLs', () => {
        const oauth = spec.components.securitySchemes.oauthAuthCode;
        expect(oauth.type).toBe('oauth2');
        expect(oauth.flows.authorizationCode.authorizationUrl).toBe(
            'https://www.canva.com/api/oauth/authorize'
        );
        expect(oauth.flows.authorizationCode.tokenUrl).toBe(
            'https://api.canva.com/rest/v1/oauth/token'
        );
        expect(spec.components.securitySchemes.basicAuth.type).toBe('http');
        expect(spec.components.securitySchemes.basicAuth.scheme).toBe('basic');
    });
});
