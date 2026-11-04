const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'gorgias.openapi.yaml'),
        'utf8'
    )
);

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'gorgias.capabilities.json'),
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
        expect(api.baseUrl).toBe('https://{domain}.gorgias.com');
    });

    it('declares OAuth2 authorizationCode security matching Gorgias', () => {
        const scheme = spec.components.securitySchemes.OAuth2;
        expect(scheme.type).toBe('oauth2');
        expect(scheme.flows.authorizationCode.authorizationUrl).toContain(
            '.gorgias.com/oauth/authorize'
        );
        expect(scheme.flows.authorizationCode.tokenUrl).toContain(
            '.gorgias.com/oauth/token'
        );
        expect(scheme.flows.authorizationCode.scopes.offline).toBeTruthy();
        expect(scheme.flows.authorizationCode.scopes['tickets:read']).toBeTruthy();
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for this package version', () => {
        expect(capabilities.$schema).toContain('capability-manifest/v0.1');
        expect(capabilities.module).toBe('gorgias');
        expect(capabilities.package).toBe(
            '@friggframework/api-module-gorgias'
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
        const customerEmail = capabilities.objects.customer.fields.find(
            (f) => f.name === 'email'
        );
        expect(customerEmail.tag).toBe('contact.email');
    });
});
