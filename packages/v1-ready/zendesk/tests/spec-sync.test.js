const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'zendesk.openapi.yaml'),
        'utf8'
    )
);

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'zendesk.capabilities.json'),
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
        const api = new Api({});
        expect(spec.servers[0].url).toBe(api.baseUrl);
        expect(api.baseUrl).toBe('https://{subdomain}.zendesk.com/api/v2');
    });

    it('declares OAuth2 authorizationCode security matching Zendesk', () => {
        const scheme = spec.components.securitySchemes.OAuth2;
        expect(scheme.type).toBe('oauth2');
        expect(scheme.flows.authorizationCode.authorizationUrl).toContain(
            '.zendesk.com/oauth/authorizations/new'
        );
        expect(scheme.flows.authorizationCode.tokenUrl).toContain(
            '.zendesk.com/oauth/tokens'
        );
        expect(
            scheme.flows.authorizationCode.scopes['tickets:read']
        ).toBeTruthy();
        expect(
            scheme.flows.authorizationCode.scopes['webhooks:write']
        ).toBeTruthy();
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for this package version', () => {
        expect(capabilities.$schema).toContain('capability-manifest/v0.1');
        expect(capabilities.module).toBe('zendesk');
        expect(capabilities.package).toBe(
            '@friggframework/api-module-zendesk'
        );
        expect(capabilities.version).toBe(
            require('../package.json').version
        );
        expect(capabilities.auth).toBe('oauth2');
    });

    it('every capability method exists on Api', () => {
        const methods = Object.values(capabilities.capabilities).map(
            (c) => c.method
        );
        const missing = methods.filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });

    it('objects declare fields with tags where appropriate', () => {
        const ticketTags = capabilities.objects.ticket.fields
            .filter((f) => f.tag)
            .map((f) => f.tag);
        expect(ticketTags).toContain('record.displayName');
        expect(ticketTags).toContain('record.updatedAt');
        const userEmail = capabilities.objects.user.fields.find(
            (f) => f.name === 'email'
        );
        expect(userEmail.tag).toBe('contact.email');
    });
});
