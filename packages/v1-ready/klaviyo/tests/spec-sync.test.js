const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'klaviyo.openapi.yaml'), 'utf8')
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
        const api = new Api({ api_key: 'pk_x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares Authorization apiKey security matching the client', () => {
        const scheme = spec.components.securitySchemes.KlaviyoApiKey;
        const api = new Api({ api_key: 'pk_x' });
        expect(scheme.type).toBe('apiKey');
        expect(scheme.in).toBe('header');
        expect(scheme.name).toBe('Authorization');
        expect(scheme.name).toBe(api.api_key_name);
    });

    it('pins the revision header default to the client default', () => {
        const revisionParam =
            spec.components.parameters.Revision.schema.default;
        const api = new Api({ api_key: 'pk_x' });
        expect(revisionParam).toBe(api.revision);
    });
});
