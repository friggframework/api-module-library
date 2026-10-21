const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'shopware.openapi.yaml'),
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

    it('the base server URL matches the client baseUrl', () => {
        const api = new Api({
            api_partner_id: 'x',
            api_secret: 'y',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares dual apiKey security matching the client headers', async () => {
        const partner = spec.components.securitySchemes.ApiPartnerId;
        const secret = spec.components.securitySchemes.ApiSecret;
        expect(partner.type).toBe('apiKey');
        expect(partner.in).toBe('header');
        expect(partner.name).toBe('X-Api-Partner-Id');
        expect(secret.type).toBe('apiKey');
        expect(secret.in).toBe('header');
        expect(secret.name).toBe('X-Api-Secret');

        const api = new Api({
            api_partner_id: 'pid',
            api_secret: 'sec',
        });
        const headers = await api.addAuthHeaders({});
        expect(headers[partner.name]).toBe('pid');
        expect(headers[secret.name]).toBe('sec');
    });
});
