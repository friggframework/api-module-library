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

    it('declares vendor-aligned security schemes (oauth2, bearer, PRIVATE-TOKEN)', () => {
        const schemes = spec.components.securitySchemes;
        expect(schemes.bearerAuth.type).toBe('http');
        expect(schemes.bearerAuth.scheme).toBe('bearer');
        expect(schemes.privateToken.type).toBe('apiKey');
        expect(schemes.privateToken.name).toBe('PRIVATE-TOKEN');
        expect(schemes.privateToken.in).toBe('header');
        const oauth = schemes.OAuth2;
        expect(oauth.type).toBe('oauth2');
        expect(oauth.flows.authorizationCode.authorizationUrl).toBe(
            'https://gitlab.com/oauth/authorize'
        );
        expect(oauth.flows.authorizationCode.tokenUrl).toBe(
            'https://gitlab.com/oauth/token'
        );
        expect(oauth.flows.authorizationCode.scopes).toHaveProperty('api');
        expect(oauth.flows.authorizationCode.scopes).toHaveProperty(
            'read_user'
        );
    });

    it('documents server URL composed from vendor host + /api/v4 path prefix', () => {
        expect(spec.servers[0].url).toBe('https://gitlab.com/api/v4');
        expect(spec.info.description).toContain('openapi_v2.yaml');
    });

    it('aligns issue_type and labels types with vendor OpenAPI', () => {
        const createIssue =
            spec.paths['/projects/{id}/issues'].post.requestBody.content[
                'application/json'
            ].schema;
        expect(createIssue.properties.issue_type.enum).toEqual([
            'issue',
            'incident',
            'test_case',
            'requirement',
            'task',
            'ticket',
        ]);
        expect(createIssue.properties.labels.type).toBe('array');
        const listLabels =
            spec.paths['/projects/{id}/issues'].get.parameters.find(
                (p) => p.name === 'labels'
            );
        expect(listLabels.schema.type).toBe('array');
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
