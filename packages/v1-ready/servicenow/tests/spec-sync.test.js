const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'servicenow.openapi.yaml'),
        'utf8'
    )
);

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'servicenow.capabilities.json'),
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
        expect(api.baseUrl).toBe('https://{instance}.service-now.com');
        expect(spec.servers[0].variables.instance.default).toBe('example');
    });

    it('declares bearerAuth and basicAuth security', () => {
        expect(spec.components.securitySchemes.bearerAuth.scheme).toBe(
            'bearer'
        );
        expect(spec.components.securitySchemes.basicAuth.scheme).toBe('basic');
        expect(spec.security).toEqual([
            { bearerAuth: [] },
            { basicAuth: [] },
        ]);
    });

    it('uses Table API and Attachment API path prefixes only', () => {
        for (const p of Object.keys(spec.paths)) {
            expect(
                p.startsWith('/api/now/table/') ||
                    p.startsWith('/api/now/attachment')
            ).toBe(true);
        }
        expect(
            spec.paths['/api/now/table/sn_customerservice_case']
        ).toBeTruthy();
        expect(spec.paths['/api/now/table/csm_case']).toBeUndefined();
    });

    it('documents official Table API query params on listIncidents', () => {
        const params = spec.paths['/api/now/table/incident'].get.parameters.map(
            (p) => p.$ref || p.name
        );
        expect(params.join(' ')).toMatch(/sysparm_query/);
        expect(params.join(' ')).toMatch(/sysparm_limit/);
        expect(params.join(' ')).toMatch(/sysparm_offset/);
        expect(params.join(' ')).toMatch(/sysparm_fields/);
        expect(params.join(' ')).toMatch(/sysparm_display_value/);
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for this package version', () => {
        expect(capabilities.$schema).toContain('capability-manifest/v0.1');
        expect(capabilities.module).toBe('servicenow');
        expect(capabilities.package).toBe(
            '@friggframework/api-module-servicenow'
        );
        expect(capabilities.version).toBe(require('../package.json').version);
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
        const incidentTags = capabilities.objects.incident.fields
            .filter((f) => f.tag)
            .map((f) => f.tag);
        expect(incidentTags).toContain('record.displayName');
        expect(incidentTags).toContain('record.updatedAt');
        const userEmail = capabilities.objects.user.fields.find(
            (f) => f.name === 'email'
        );
        expect(userEmail.tag).toBe('contact.email');
    });

    it('does not claim a webhook.subscribe capability', () => {
        expect(capabilities.capabilities['webhook.create']).toBeUndefined();
        expect(capabilities.capabilities['webhook.subscribe']).toBeUndefined();
        expect(capabilities.skipped.notes.join(' ')).toMatch(/webhook/i);
    });
});
