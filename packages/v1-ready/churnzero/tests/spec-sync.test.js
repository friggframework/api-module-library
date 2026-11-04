const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api, DEFAULT_BASE_URL } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'churnzero.openapi.yaml'),
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

    it('the base server URL matches the client default baseUrl', () => {
        const api = new Api({ username: 'x', api_key: 'y' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
        expect(spec.servers[0].url).toBe(DEFAULT_BASE_URL);
    });

    it('declares HTTP Basic auth security', () => {
        const scheme = spec.components.securitySchemes.BasicAuth;
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('basic');
    });
});
