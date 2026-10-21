const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'axiscare.openapi.yaml'),
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

    it('the base server URL matches the client baseUrl template', () => {
        const api = new Api({ api_key: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
        expect(spec.servers[0].url).toBe('https://{siteNumber}.axiscare.com');
    });

    it('declares Bearer auth matching the client Authorization header', () => {
        const scheme = spec.components.securitySchemes.BearerAuth;
        const api = new Api({ api_key: 'x' });
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('bearer');
        expect(api.api_key_name).toBe('Authorization');
    });

    it('requires the vendor X-AxisCare-Api-Version header enum', () => {
        const versionParam = spec.components.parameters.ApiVersion;
        expect(versionParam.name).toBe('X-AxisCare-Api-Version');
        expect(versionParam.schema.enum).toEqual(['2023-10-01']);
        expect(Api.API_KEY_VERSION).toBe('2023-10-01');
    });
});
