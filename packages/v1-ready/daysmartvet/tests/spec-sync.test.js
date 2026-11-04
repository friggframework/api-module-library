const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'daysmartvet.openapi.yaml'),
        'utf8'
    )
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

    it('declares Bearer + x-api-key security matching the client', () => {
        const bearer = spec.components.securitySchemes.BearerAuth;
        const apiKey = spec.components.securitySchemes.ApiKeyHeader;
        expect(bearer.type).toBe('http');
        expect(bearer.scheme).toBe('bearer');
        expect(apiKey.type).toBe('apiKey');
        expect(apiKey.in).toBe('header');
        expect(apiKey.name).toBe('x-api-key');
    });

    it('capability methods all exist on Api', () => {
        const caps = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'daysmartvet.capabilities.json'),
                'utf8'
            )
        );
        const methods = new Set();
        for (const obj of Object.values(caps.objects || {})) {
            for (const cap of Object.values(obj.capabilities || {})) {
                if (cap.method) methods.add(cap.method);
            }
        }
        if (caps.auth?.methods?.getToken) {
            methods.add(caps.auth.methods.getToken);
        }
        if (caps.auth?.methods?.testAuth) {
            methods.add(caps.auth.methods.testAuth);
        }
        const missing = [...methods].filter(
            (m) => typeof Api.prototype[m] !== 'function'
        );
        expect(missing).toEqual([]);
    });
});
