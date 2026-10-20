const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'gitlab.openapi.yaml'), 'utf8')
);

const specOperationIds = Object.values(spec.paths).flatMap((item) =>
    Object.entries(item)
        .filter(([m]) => ['get', 'post', 'patch', 'put', 'delete'].includes(m))
        .map(([, op]) => op.operationId)
);

const NON_OPERATION_METHODS = new Set([
    'constructor',
    'addAuthHeaders',
    'getAuthorizationUri',
    'getAuthUri',
    'getAuthorizationRequirements',
    'verifyWebhookSignature',
    '_buildAuthorizationUri',
    '_filterQuery',
]);

const clientMethods = Object.getOwnPropertyNames(Api.prototype).filter(
    (m) => typeof Api.prototype[m] === 'function' && m !== 'constructor'
);

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'gitlab.capabilities.json'),
        'utf8'
    )
);

describe('OpenAPI spec ↔ client sync', () => {
    it('every operationId has a matching client method', () => {
        const missing = specOperationIds.filter(
            (op) => !clientMethods.includes(op)
        );
        expect(missing).toEqual([]);
    });

    it('the base server URL matches the client baseUrl', () => {
        const api = new Api({ access_token: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares bearer token security matching GitLab OAuth/PAT', () => {
        const scheme = spec.components.securitySchemes.bearerAuth;
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('bearer');
    });

    it('every resource client method is declared in the OpenAPI (1:1)', () => {
        const resourceMethods = clientMethods.filter(
            (m) => !NON_OPERATION_METHODS.has(m)
        );
        const undeclared = resourceMethods.filter(
            (m) => !specOperationIds.includes(m)
        );
        expect(undeclared).toEqual([]);
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for this package version', () => {
        expect(capabilities.$schema).toContain('capability-manifest/v0.1');
        expect(capabilities.module).toBe('gitlab');
        expect(capabilities.package).toBe('@friggframework/api-module-gitlab');
        expect(capabilities.version).toBe(require('../package.json').version);
        expect(capabilities.auth).toBe('oauth2');
    });

    it('every capability method exists on Api', () => {
        const missing = Object.entries(capabilities.capabilities)
            .filter(([, cap]) => !clientMethods.includes(cap.method))
            .map(([name, cap]) => `${name} → ${cap.method}`);
        expect(missing).toEqual([]);
    });

    it('webhook.verify points at verifyWebhookSignature', () => {
        expect(capabilities.webhook.verify).toBe('verifyWebhookSignature');
        expect(clientMethods).toContain('verifyWebhookSignature');
    });

    it('object fields carry tags where declared', () => {
        const tagged = Object.values(capabilities.objects).flatMap((obj) =>
            (obj.fields || []).filter((f) => f.tag)
        );
        expect(tagged.length).toBeGreaterThan(0);
        expect(tagged.some((f) => f.tag === 'contact.email')).toBe(true);
    });
});
