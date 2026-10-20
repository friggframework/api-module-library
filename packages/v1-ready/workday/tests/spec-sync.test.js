const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'workday.openapi.yaml'), 'utf8')
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
        const api = new Api({});
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares OAuth2 security matching Extend token + authorize URLs', () => {
        const scheme = spec.components.securitySchemes.OAuth2;
        expect(scheme.type).toBe('oauth2');
        expect(scheme.flows.authorizationCode.authorizationUrl).toBe(
            'https://auth.api.workday.com/v1/authorize'
        );
        expect(scheme.flows.authorizationCode.tokenUrl).toBe(
            'https://auth.api.workday.com/v1/token'
        );
        expect(scheme.flows.clientCredentials.tokenUrl).toBe(
            'https://auth.api.workday.com/v1/token'
        );
    });

    it('capability methods all exist on Api', () => {
        const caps = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'workday.capabilities.json'),
                'utf8'
            )
        );
        const missing = Object.values(caps.capabilities)
            .map((c) => c.method)
            .filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });
});
