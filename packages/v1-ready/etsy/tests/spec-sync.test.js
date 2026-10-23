const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'etsy.openapi.yaml'), 'utf8')
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

    it('declares x-api-key and OAuth2 PKCE security schemes', () => {
        const schemes = spec.components.securitySchemes;
        expect(schemes.api_key.type).toBe('apiKey');
        expect(schemes.api_key.name).toBe('x-api-key');
        expect(schemes.api_key.in).toBe('header');
        expect(schemes.oauth2.type).toBe('oauth2');
        expect(
            schemes.oauth2.flows.authorizationCode.authorizationUrl
        ).toBe('https://www.etsy.com/oauth/connect');
        expect(schemes.oauth2.flows.authorizationCode.tokenUrl).toBe(
            'https://api.etsy.com/v3/public/oauth/token'
        );
        expect(schemes.oauth2.flows.authorizationCode.scopes).toHaveProperty(
            'listings_r'
        );
        expect(schemes.oauth2.flows.authorizationCode.scopes).toHaveProperty(
            'transactions_r'
        );
    });

    it('capability methods all exist on Api', () => {
        const caps = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'etsy.capabilities.json'),
                'utf8'
            )
        );
        const missing = Object.values(caps.capabilities)
            .map((c) => c.method)
            .filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });
});
