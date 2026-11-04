const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'huggg.openapi.yaml'), 'utf8')
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
        const api = new Api({ api_key: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares X-Huggg-API-Key apiKey security matching the client', () => {
        const scheme = spec.components.securitySchemes.ApiKeyAuth;
        const api = new Api({ api_key: 'x' });
        expect(scheme.type).toBe('apiKey');
        expect(scheme.in).toBe('header');
        expect(scheme.name).toBe('X-Huggg-API-Key');
        expect(scheme.name).toBe(api.api_key_name);
    });

    it('capability methods all exist on Api', () => {
        const manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'huggg.capabilities.json'),
                'utf8'
            )
        );
        const missing = Object.values(manifest.capabilities)
            .map((c) => c.method)
            .filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });
});
