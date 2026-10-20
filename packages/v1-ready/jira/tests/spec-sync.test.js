const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'jira.openapi.yaml'), 'utf8')
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
        const api = new Api({});
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares OAuth2 security matching official swagger classic scopes', () => {
        const scheme = spec.components.securitySchemes.OAuth2;
        expect(scheme.type).toBe('oauth2');
        expect(scheme.flows.authorizationCode.authorizationUrl).toBe(
            'https://auth.atlassian.com/authorize'
        );
        expect(scheme.flows.authorizationCode.tokenUrl).toBe(
            'https://auth.atlassian.com/oauth/token'
        );
        // offline_access is auth-server only (3LO docs), not in swagger-v3 scopes
        expect(scheme.flows.authorizationCode.scopes).not.toHaveProperty(
            'offline_access'
        );
        expect(scheme.flows.authorizationCode.scopes).toHaveProperty(
            'manage:jira-webhook'
        );
        expect(scheme.flows.authorizationCode.scopes).toHaveProperty(
            'read:jira-work'
        );
    });

    it('uses official swagger operationIds for curated Jira REST ops', () => {
        expect(specOperationIds).toEqual(
            expect.arrayContaining([
                'getCurrentUser',
                'searchProjects',
                'createProject',
                'getProject',
                'updateProject',
                'createIssue',
                'getIssue',
                'editIssue',
                'deleteIssue',
                'searchAndReconsileIssuesUsingJql',
                'getComments',
                'addComment',
                'findUsers',
                'getDynamicWebhooksForApp',
                'registerDynamicWebhooks',
                'deleteWebhookById',
                'refreshWebhooks',
            ])
        );
        // accessible-resources is Atlassian auth API, not Jira swagger-v3
        expect(specOperationIds).not.toContain('getAccessibleResources');
    });
});

describe('Capability manifest ↔ client sync', () => {
    const manifest = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, '..', 'jira.capabilities.json'),
            'utf8'
        )
    );

    it('is capability-manifest/v0.1 shaped for this package', () => {
        expect(manifest.$schema).toMatch(/capability-manifest\/v0\.1/);
        expect(manifest.module).toBe('jira');
        expect(manifest.package).toBe('@friggframework/api-module-jira');
        expect(manifest.version).toBe(require('../package.json').version);
        expect(manifest.auth).toBe('oauth2');
        expect(manifest.objects.issue.fields.length).toBeGreaterThan(0);
        expect(manifest.objects.issue.fields.some((f) => f.tag)).toBe(true);
    });

    it('every capability maps to a real Api method', () => {
        const missing = Object.entries(manifest.capabilities)
            .filter(([, cap]) => !cap.status || cap.status !== 'unimplemented')
            .map(([, cap]) => cap.method)
            .filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });

    it('webhook.verify points at verifyWebhookSignature', () => {
        expect(manifest.webhook.verify).toBe('verifyWebhookSignature');
        expect(clientMethods).toContain('verifyWebhookSignature');
    });
});
