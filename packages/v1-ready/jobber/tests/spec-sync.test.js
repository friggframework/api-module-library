const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'jobber.openapi.yaml'), 'utf8')
);

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'jobber.capabilities.json'),
        'utf8'
    )
);

const specOperationIds = Object.values(spec.paths).flatMap((item) =>
    Object.entries(item)
        .filter(([m]) => ['get', 'post', 'patch', 'put', 'delete'].includes(m))
        .map(([, op]) => op.operationId)
);

const NON_OPERATION_METHODS = new Set([
    'constructor',
    'graphql',
    'getAuthUri',
    'getTokenFromCode',
    'refreshAccessToken',
    '_paginationVars',
]);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

const graphqlIssuingMethods = clientMethods.filter(
    (m) => !NON_OPERATION_METHODS.has(m)
);

describe('OpenAPI spec ↔ client sync', () => {
    it('every operationId has a matching client method', () => {
        const missing = specOperationIds.filter(
            (op) => !clientMethods.includes(op)
        );
        expect(missing).toEqual([]);
    });

    it('every GraphQL-issuing client method is declared in the OpenAPI spec', () => {
        const undeclared = graphqlIssuingMethods.filter(
            (m) => !specOperationIds.includes(m)
        );
        expect(undeclared).toEqual([]);
    });

    it('the base server URL matches the client baseUrl', () => {
        const api = new Api({
            client_id: 'x',
            client_secret: 'y',
            redirect_uri: 'https://example.com/jobber',
        });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares bearer OAuth2 security', () => {
        const scheme = spec.components.securitySchemes.bearerAuth;
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('bearer');
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for module jobber', () => {
        expect(capabilities.$schema).toMatch(/capability-manifest\/v0\.1/);
        expect(capabilities.module).toBe('jobber');
        expect(capabilities.package).toBe('@friggframework/api-module-jobber');
        expect(capabilities.auth).toBe('oauth2');
    });

    it('every capability method maps to a real Api method', () => {
        const missing = Object.values(capabilities.capabilities)
            .map((c) => c.method)
            .filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });
});
