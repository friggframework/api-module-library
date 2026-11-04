const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');
const pkg = require('../index');

describe('Chargebee Definition', () => {
    it('is a basic-auth module named chargebee wired to the Api class', () => {
        expect(Definition.moduleName).toBe('chargebee');
        expect(Definition.getName()).toBe('chargebee');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Chargebee');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes a Basic auth form for site + api_key', async () => {
        const api = new Api({});
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements(
                api
            );
        expect(reqs.type).toBe('basic');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['site', 'api_key'])
        );
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('persists api_key and site on the credential', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_key', 'site'],
            entity: ['site'],
        });
    });

    it('setAuthParams wires site and api_key onto the client', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            site: 'acme-test',
            api_key: 'form-key',
        });
        expect(api.site).toBe('acme-test');
        expect(api.api_key).toBe('form-key');
        expect(api.username).toBe('form-key');
        expect(api.baseUrl).toBe('https://acme-test.chargebee.com/api/v2');
    });

    it('getEntityDetails uses the site subdomain as externalId', async () => {
        const api = new Api({ api_key: 'k', site: 'acme-test' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('acme-test');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('acme-test');
    });

    it('getCredentialDetails agrees with entity identity', async () => {
        const api = new Api({ api_key: 'k', site: 'acme-test' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('acme-test');
    });

    it('testAuthRequest performs an authenticated list call', async () => {
        const api = new Api({ api_key: 'k', site: 'acme' });
        let called = false;
        api.testAuth = async () => {
            called = true;
            return { list: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('exports extensions.webhooks and UNVALIDATED billing mappings', () => {
        expect(pkg.extensions.webhooks.name).toBe('chargebee-webhooks');
        expect(pkg.extensions.mapping.schemas.billing.schema).toBe('billing@1');
        expect(pkg.extensions.mapping.schemas.billing.validation).toBe(
            'UNVALIDATED'
        );
        expect(
            pkg.extensions.mapping.schemas.billing.objects.subscription
        ).toBeDefined();
        expect(
            pkg.extensions.mapping.schemas.billing.objects.invoice
        ).toBeDefined();
        expect(
            pkg.extensions.mapping.schemas.billing.objects.transaction
        ).toBeDefined();
    });

    it('capability manifest methods all exist on Api', () => {
        const manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'chargebee.capabilities.json'),
                'utf8'
            )
        );
        expect(manifest.schema).toBe('capability-manifest/v0.1');
        expect(manifest.module).toBe('chargebee');
        expect(manifest.package).toBe('@friggframework/api-module-chargebee');
        expect(manifest.version).toBe(
            require('../package.json').version
        );

        const methods = new Set();
        for (const obj of Object.values(manifest.objects)) {
            for (const m of obj.methods || []) methods.add(m);
        }
        for (const cap of Object.values(manifest.capabilities || {})) {
            const ref = cap.implementedBy && cap.implementedBy.ref;
            if (
                cap.implementedBy &&
                cap.implementedBy.kind === 'api-class-method' &&
                typeof ref === 'string' &&
                ref.startsWith('Api.')
            ) {
                methods.add(ref.slice(4));
            }
        }

        const missing = [...methods].filter(
            (m) => typeof Api.prototype[m] !== 'function'
        );
        expect(missing).toEqual([]);
    });
});
