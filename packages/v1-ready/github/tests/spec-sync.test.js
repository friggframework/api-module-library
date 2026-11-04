const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(path.join(__dirname, '..', 'github.openapi.yaml'), 'utf8')
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
        const api = new Api({ access_token: 'x' });
        expect(spec.servers[0].url).toBe(api.baseUrl);
    });

    it('declares bearer security matching OAuth access tokens', () => {
        const scheme = spec.components.securitySchemes.BearerAuth;
        expect(scheme.type).toBe('http');
        expect(scheme.scheme).toBe('bearer');
    });

    it('aligns createPullRequest required fields with official OpenAPI', () => {
        const body =
            spec.paths['/repos/{owner}/{repo}/pulls'].post.requestBody.content[
                'application/json'
            ].schema;
        expect(body.required).toEqual(['head', 'base']);
        expect(body.properties).toHaveProperty('issue');
        expect(body.properties).toHaveProperty('head_repo');
    });

    it('aligns updateIssue state_reason enum with official OpenAPI', () => {
        const reason =
            spec.paths['/repos/{owner}/{repo}/issues/{issue_number}'].patch
                .requestBody.content['application/json'].schema.properties
                .state_reason;
        expect(reason.enum).toEqual([
            'completed',
            'not_planned',
            'duplicate',
            'reopened',
        ]);
        expect(reason.nullable).toBe(true);
    });

    it('documents since/before on listReposForAuthenticatedUser', () => {
        const names = spec.paths['/user/repos'].get.parameters.map((p) => p.name);
        expect(names).toEqual(expect.arrayContaining(['since', 'before']));
    });

    it('covers the expected core operations', () => {
        expect(specOperationIds).toEqual(
            expect.arrayContaining([
                'getAuthenticatedUser',
                'listOrganizationsForAuthenticatedUser',
                'listReposForAuthenticatedUser',
                'createRepositoryForAuthenticatedUser',
                'getRepository',
                'updateRepository',
                'listRepositoryIssues',
                'getIssue',
                'createIssue',
                'updateIssue',
                'createIssueComment',
                'listPullRequests',
                'getPullRequest',
                'createPullRequest',
                'updatePullRequest',
                'listRepositoryWebhooks',
                'getRepositoryWebhook',
                'createRepositoryWebhook',
                'updateRepositoryWebhook',
                'deleteRepositoryWebhook',
            ])
        );
    });
});
