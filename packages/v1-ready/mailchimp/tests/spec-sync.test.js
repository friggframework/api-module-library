const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'mailchimp.openapi.yaml'),
        'utf8'
    )
);

const vendor = JSON.parse(
    fs.readFileSync(
        path.join(
            __dirname,
            'fixtures',
            'vendor-marketing-3.0.91.subset.json'
        ),
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

    it('the base server URL matches the client default baseUrl', () => {
        const api = new Api({ access_token: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
        expect(spec.servers[0].url).toBe(Api.DEFAULT_BASE_URL);
        expect(spec.servers[0].url).toBe(
            `https://${vendor.host}${vendor.basePath}`
        );
    });

    it('declares BearerAuth (OAuth) and basicAuth (API key) schemes', () => {
        const bearer = spec.components.securitySchemes.BearerAuth;
        const basic = spec.components.securitySchemes.basicAuth;
        expect(bearer.type).toBe('http');
        expect(bearer.scheme).toBe('bearer');
        expect(basic.type).toBe('http');
        expect(basic.scheme).toBe('basic');
        // Vendor swagger only lists basicAuth (API-key path); we also declare
        // BearerAuth for OAuth access tokens per the OAuth guide.
        expect(vendor.securityDefinitions.basicAuth.type).toBe('basic');
        const schemes = (spec.security || []).flatMap((entry) =>
            Object.keys(entry)
        );
        expect(schemes).toEqual(
            expect.arrayContaining(['BearerAuth', 'basicAuth'])
        );
    });

    it('info.version matches the vendor swagger version', () => {
        expect(spec.info.version).toBe(vendor.info.version);
        expect(spec.info.version).toBe('3.0.91');
    });

    it('every curated path/method/operationId matches the vendor swagger', () => {
        for (const [p, item] of Object.entries(spec.paths)) {
            expect(vendor.paths[p]).toBeDefined();
            for (const [m, op] of Object.entries(item)) {
                if (
                    !['get', 'post', 'patch', 'put', 'delete'].includes(m)
                ) {
                    continue;
                }
                const vendorOp = vendor.paths[p][m];
                expect(vendorOp).toBeDefined();
                expect(op.operationId).toBe(vendorOp.operationId);
            }
        }
    });

    it('required request body fields match the vendor swagger', () => {
        for (const [p, item] of Object.entries(spec.paths)) {
            for (const [m, op] of Object.entries(item)) {
                if (!['post', 'patch', 'put'].includes(m)) continue;
                const vendorOp = vendor.paths[p][m];
                const vendorBody = (vendorOp.parameters || []).find(
                    (prm) => prm.in === 'body'
                );
                if (!vendorBody || !vendorBody.required_body_fields) continue;
                const schema =
                    op.requestBody?.content?.['application/json']?.schema ||
                    {};
                expect(schema.required || []).toEqual(
                    vendorBody.required_body_fields
                );
            }
        }
    });

    it('capability methods all exist on Api', () => {
        const caps = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'mailchimp.capabilities.json'),
                'utf8'
            )
        );
        const missing = Object.values(caps.capabilities)
            .map((c) => c.method)
            .filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });
});
