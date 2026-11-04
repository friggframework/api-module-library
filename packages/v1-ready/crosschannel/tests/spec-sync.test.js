const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'crosschannel.openapi.yaml'),
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
        const api = new Api({});
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares Bearer / OAuth2 client_credentials matching the client', () => {
        const bearer = spec.components.securitySchemes.BearerAuth;
        expect(bearer.type).toBe('http');
        expect(bearer.scheme).toBe('bearer');

        const oauth = spec.components.securitySchemes.OAuth2;
        expect(oauth.type).toBe('oauth2');
        expect(oauth.flows.clientCredentials.tokenUrl).toBe(
            'https://auth.listrak.com/OAuth2/Token'
        );

        const api = new Api({});
        expect(api.tokenUri).toBe(
            oauth.flows.clientCredentials.tokenUrl
        );
        expect(api.grant_type).toBe('client_credentials');
    });

    it('covers the three official Cross Channel operations', () => {
        expect(specOperationIds.sort()).toEqual(
            [
                'getEventConfigurations',
                'getSchemaByEventUid',
                'postEvents',
            ].sort()
        );
    });

    it('capability manifest methods all exist on Api', () => {
        const caps = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'crosschannel.capabilities.json'),
                'utf8'
            )
        );
        expect(caps.schema).toBe('capability-manifest/v0.1');
        expect(caps.module).toBe('crosschannel');
        expect(caps.package).toBe('@friggframework/api-module-crosschannel');
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

    it('documents that canonical mappings were skipped (ADR-057)', () => {
        const caps = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'crosschannel.capabilities.json'),
                'utf8'
            )
        );
        expect(caps.skipped.canonicalSchemaMapping).toBeDefined();
        expect(caps.skipped.canonicalSchemaMapping.reason).toMatch(/ADR-057/);
        expect(
            fs.existsSync(
                path.join(__dirname, '..', 'extensions', 'mapping.js')
            )
        ).toBe(false);
    });
});
