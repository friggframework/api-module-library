const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'quo.openapi.yaml'), 'utf8')
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

    it('the base server URL matches the client default baseUrl', () => {
        const api = new Api({ api_key: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares Authorization apiKey security with NO Bearer prefix', () => {
        const scheme = spec.components.securitySchemes.ApiKeyAuth;
        expect(scheme.type).toBe('apiKey');
        expect(scheme.in).toBe('header');
        // Quo/OpenPhone sends the raw key in `Authorization` — not `x-api-key`,
        // and NOT as an http/bearer scheme. The client mirrors this via
        // api_key_name = 'Authorization'.
        expect(scheme.name).toBe('Authorization');
        expect(scheme.type).not.toBe('http');
        const api = new Api({ api_key: 'x' });
        expect(api.api_key_name).toBe(scheme.name);
    });
});
