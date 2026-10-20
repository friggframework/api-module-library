const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Api } = require('../api');

const spec = yaml.load(
    fs.readFileSync(
        path.join(__dirname, '..', 'microsoft-outlook.openapi.yaml'),
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

const capabilities = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '..', 'microsoft-outlook.capabilities.json'),
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

    it('declares OAuth2 security matching the client', () => {
        const scheme = spec.components.securitySchemes.OAuth2;
        expect(scheme.type).toBe('oauth2');
        expect(scheme.flows.authorizationCode).toBeDefined();
    });
});

describe('Capability manifest ↔ client sync', () => {
    it('is capability-manifest/v0.1 for this package version', () => {
        expect(capabilities.$schema).toContain('capability-manifest/v0.1');
        expect(capabilities.module).toBe('microsoft-outlook');
        expect(capabilities.package).toBe(
            '@friggframework/api-module-microsoft-outlook'
        );
        expect(capabilities.version).toBe(
            require('../package.json').version
        );
        expect(capabilities.auth).toBe('oauth2');
    });

    it('every capability method exists on Api', () => {
        const methods = Object.values(capabilities.capabilities)
            .map((c) => c.method)
            .filter(Boolean);
        const missing = methods.filter((m) => !clientMethods.includes(m));
        expect(missing).toEqual([]);
    });

    it('declares a fenestra UI capability pointing at the module fenestra draft', () => {
        const ui = capabilities.capabilities['ui.outlookAddIns'];
        expect(ui).toBeDefined();
        expect(ui.spec).toEqual({
            kind: 'fenestra',
            ref: './microsoft-outlook.fenestra.yaml',
        });
        expect(
            fs.existsSync(
                path.join(__dirname, '..', 'microsoft-outlook.fenestra.yaml')
            )
        ).toBe(true);
    });

    it('webhook.verify maps to verifyWebhookClientState', () => {
        expect(capabilities.webhook.verify).toBe('verifyWebhookClientState');
        expect(clientMethods).toContain('verifyWebhookClientState');
    });

    it('objects declare fields with tags where applicable', () => {
        for (const [name, obj] of Object.entries(capabilities.objects)) {
            expect(Array.isArray(obj.fields)).toBe(true);
            expect(obj.fields.length).toBeGreaterThan(0);
            const tagged = obj.fields.filter((f) => f.tag);
            if (['message', 'event', 'calendar', 'mailFolder'].includes(name)) {
                expect(tagged.length).toBeGreaterThan(0);
            }
        }
    });
});
