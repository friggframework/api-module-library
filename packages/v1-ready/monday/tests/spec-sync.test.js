const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'monday.openapi.yaml'), 'utf8')
);

const specOperationIds = Object.values(spec.paths).flatMap((item) =>
    Object.entries(item)
        .filter(([m]) => ['get', 'post', 'patch', 'put', 'delete'].includes(m))
        .map(([, op]) => op.operationId)
);

const NON_OPERATION_METHODS = new Set([
    'constructor',
    'graphql',
    'addAuthHeaders',
    'getTokenFromCode',
    'verifyWebhookSignature',
    '_buildAuthorizationUri',
]);

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
        const api = new Api({ access_token: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares OAuth2 authorization-code security matching monday OAuth', () => {
        const oauth = spec.components.securitySchemes.OAuth2;
        expect(oauth.type).toBe('oauth2');
        expect(oauth.flows.authorizationCode.authorizationUrl).toBe(
            'https://auth.monday.com/oauth2/authorize'
        );
        expect(oauth.flows.authorizationCode.tokenUrl).toBe(
            'https://auth.monday.com/oauth2/token'
        );
        expect(oauth.flows.authorizationCode.scopes).toHaveProperty('boards:read');
        expect(oauth.flows.authorizationCode.scopes).toHaveProperty(
            'webhooks:write'
        );
    });

    it('every GraphQL-issuing client method is declared in the OpenAPI (1:1)', () => {
        const graphqlMethods = clientMethods.filter(
            (m) => !NON_OPERATION_METHODS.has(m)
        );
        const undeclared = graphqlMethods.filter(
            (m) => !specOperationIds.includes(m)
        );
        expect(undeclared).toEqual([]);
    });
});

describe('capability manifest ↔ client sync', () => {
    const manifest = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, '..', 'monday.capabilities.json'),
            'utf8'
        )
    );

    it('is capability-manifest/v0.1 for module monday at package version', () => {
        expect(manifest.$schema).toContain('capability-manifest/v0.1');
        expect(manifest.module).toBe('monday');
        expect(manifest.package).toBe('@friggframework/api-module-monday');
        expect(manifest.version).toBe(
            require('../package.json').version
        );
        expect(manifest.auth).toBe('oauth2');
    });

    it('every capability method exists on Api', () => {
        const missing = Object.entries(manifest.capabilities)
            .filter(([, cap]) => !clientMethods.includes(cap.method))
            .map(([name, cap]) => `${name} → ${cap.method}`);
        expect(missing).toEqual([]);
    });

    it('webhook.verify points at verifyWebhookSignature', () => {
        expect(manifest.webhook.verify).toBe('verifyWebhookSignature');
        expect(clientMethods).toContain('verifyWebhookSignature');
    });
});
