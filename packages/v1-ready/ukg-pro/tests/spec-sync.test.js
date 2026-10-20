const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'ukg-pro.openapi.yaml'), 'utf8')
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
        const api = new Api({
            username: 'x',
            password: 'y',
            customer_api_key: 'z',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares Basic + US-Customer-Api-Key security matching the client', async () => {
        const basic = spec.components.securitySchemes.BasicAuth;
        const key = spec.components.securitySchemes.CustomerApiKey;
        expect(basic.type).toBe('http');
        expect(basic.scheme).toBe('basic');
        expect(key.type).toBe('apiKey');
        expect(key.in).toBe('header');
        expect(key.name).toBe('US-Customer-Api-Key');

        const api = new Api({
            username: 'u',
            password: 'p',
            customer_api_key: 'KEY',
        });
        const headers = await api.addAuthHeaders({});
        expect(headers.Authorization).toMatch(/^Basic /);
        expect(headers[key.name]).toBe('KEY');
    });
});
