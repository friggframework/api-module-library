const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'clickup.openapi.yaml'), 'utf8')
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
        const api = new Api({ access_token: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares Authorization_Token apiKey security matching the vendor OpenAPI', () => {
        const scheme = spec.components.securitySchemes.Authorization_Token;
        expect(scheme.type).toBe('apiKey');
        expect(scheme.in).toBe('header');
        expect(scheme.name).toBe('Authorization');
        expect(spec.security).toEqual([{ Authorization_Token: [] }]);
    });

    it('uses the vendor server URL (not /api/v2 as the server root)', () => {
        expect(spec.servers[0].url).toBe('https://api.clickup.com/api');
        const paths = Object.keys(spec.paths);
        expect(paths.every((p) => p.startsWith('/v2/'))).toBe(true);
    });
});

