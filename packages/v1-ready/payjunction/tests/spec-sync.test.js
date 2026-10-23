const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'payjunction.openapi.yaml'),
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
        const api = new Api({
            client_id: 'c',
            client_secret: 's',
            redirect_uri: 'https://ex.com/r',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares Bearer + X-PJ-Application-Key security', () => {
        const schemes = spec.components.securitySchemes;
        expect(schemes.BearerAuth.type).toBe('http');
        expect(schemes.BearerAuth.scheme).toBe('bearer');
        expect(schemes.ApplicationKey.type).toBe('apiKey');
        expect(schemes.ApplicationKey.in).toBe('header');
        expect(schemes.ApplicationKey.name).toBe('X-PJ-Application-Key');
    });

    it('capability methods all exist on Api', () => {
        const caps = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'payjunction.capabilities.json'),
                'utf8'
            )
        );
        const refs = Object.values(caps.capabilities).map(
            (c) => c.implementedBy.ref
        );
        for (const ref of refs) {
            const method = ref.replace(/^Api\./, '');
            expect(clientMethods).toContain(method);
        }
    });
});
