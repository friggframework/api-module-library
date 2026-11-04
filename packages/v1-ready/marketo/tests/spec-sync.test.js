const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'marketo.openapi.yaml'), 'utf8')
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
        const api = new Api({});
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares Bearer auth matching Authorization: Bearer usage', () => {
        const scheme = spec.components.securitySchemes.BearerAuth;
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('bearer');
    });

    it('capability manifest methods all exist on Api', () => {
        const caps = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'marketo.capabilities.json'),
                'utf8'
            )
        );
        expect(caps.schema).toBe('capability-manifest/v0.1');
        expect(caps.module).toBe('marketo');
        expect(caps.package).toBe('@friggframework/api-module-marketo');
        expect(caps.version).toBe(
            JSON.parse(
                fs.readFileSync(
                    path.join(__dirname, '..', 'package.json'),
                    'utf8'
                )
            ).version
        );

        const methods = new Set();
        for (const obj of Object.values(caps.objects)) {
            expect(Array.isArray(obj.fields)).toBe(true);
            for (const field of obj.fields) {
                expect(field).toHaveProperty('name');
                expect(field).toHaveProperty('tags');
            }
            for (const cap of Object.values(obj.capabilities || {})) {
                methods.add(cap.method);
            }
        }
        methods.add(caps.auth.methods.getToken);
        methods.add(caps.auth.methods.testAuth);

        const missing = [...methods].filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });
});
