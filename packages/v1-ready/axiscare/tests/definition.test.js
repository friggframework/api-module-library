const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const { Definition } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('AxisCare Definition', () => {
    it('is an api-key module named axiscare wired to the Api class', () => {
        expect(Definition.moduleName).toBe('axiscare');
        expect(Definition.getName()).toBe('axiscare');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('AxisCare');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for api_key and siteNumber', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toEqual(
            expect.arrayContaining(['api_key', 'siteNumber'])
        );
        expect(reqs.data.uiSchema.api_key['ui:widget']).toBe('password');
    });

    it('persists api_key and siteNumber credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['api_key', 'siteNumber'],
            entity: [],
        });
        expect(Definition.encryption.credentialFields).toContain('api_key');
    });

    it('setAuthParams sets the api key and site number', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            api_key: 'form-key',
            siteNumber: 'site42',
        });
        expect(api.api_key_raw).toBe('form-key');
        expect(api.api_key).toBe('Bearer form-key');
        expect(api.siteNumber).toBe('site42');
        expect(api.baseUrl).toBe('https://site42.axiscare.com');
    });

    it('setAuthParams rejects missing fields', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.setAuthParams(api, {
                api_key: 'k',
            })
        ).rejects.toThrow(/Site number/);
        await expect(
            Definition.requiredAuthMethods.setAuthParams(api, {
                siteNumber: 's',
            })
        ).rejects.toThrow(/API key/);
    });

    it('getEntityDetails uses the siteNumber as externalId', async () => {
        const api = new Api({ api_key: 'k', siteNumber: 'agency7' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('agency7');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('AxisCare agency7');
    });

    it('getEntityDetails falls back to the api-key fingerprint without siteNumber', async () => {
        const api = new Api({ api_key: 'key-abc' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-abc'));
    });

    it('fingerprint fallback is STABLE for the same key and UNIQUE across keys', async () => {
        const idFor = async (key) =>
            (
                await Definition.requiredAuthMethods.getEntityDetails(
                    new Api({ api_key: key }),
                    {},
                    {},
                    'u'
                )
            ).identifiers.externalId;
        expect(await idFor('cust-A-key')).toBe(await idFor('cust-A-key'));
        expect(await idFor('cust-A-key')).not.toBe(await idFor('cust-B-key'));
    });

    it('throws rather than returning a shared constant when nothing can be derived', async () => {
        const api = new Api({});
        api.api_key = null;
        api.api_key_raw = null;
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded shared-constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]axiscare-account['"]/);
    });

    it('testAuthRequest performs an authenticated list call', async () => {
        const api = new Api({ api_key: 'k', siteNumber: 's' });
        let called = false;
        api.listClients = async () => {
            called = true;
            return { results: { clients: [] }, errors: null };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('matches the Frigg api-module-definition structural contract', () => {
        // Structural check against the published schema's required keys.
        // Function-typed properties are represented as objects in the JSON
        // Schema, so we validate presence/shape rather than AJV-typing functions.
        expect(typeof Definition.getName).toBe('function');
        expect(typeof Definition.moduleName).toBe('string');
        expect(Definition.requiredAuthMethods).toEqual(
            expect.objectContaining({
                getAuthorizationRequirements: expect.any(Function),
                setAuthParams: expect.any(Function),
                getEntityDetails: expect.any(Function),
                getCredentialDetails: expect.any(Function),
                testAuthRequest: expect.any(Function),
                apiPropertiesToPersist: expect.objectContaining({
                    credential: expect.any(Array),
                    entity: expect.any(Array),
                }),
            })
        );
    });

    it('capability manifest methods all exist on Api', () => {
        const manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'axiscare.capabilities.json'),
                'utf8'
            )
        );
        expect(manifest.$schema).toBe('capability-manifest/v0.1');
        expect(manifest.module).toBe('axiscare');
        expect(manifest.package).toBe('@friggframework/api-module-axiscare');
        expect(manifest.version).toBe(
            require('../package.json').version
        );

        const methods = [];
        for (const obj of Object.values(manifest.objects)) {
            for (const m of Object.values(obj.methods || {})) methods.push(m);
            expect(Array.isArray(obj.fields)).toBe(true);
        }
        if (manifest.helpers) {
            for (const h of Object.values(manifest.helpers)) {
                methods.push(h.method);
            }
        }
        for (const m of methods) {
            expect(typeof Api.prototype[m]).toBe('function');
        }
    });

    it('capability manifest is valid JSON (Ajv smoke)', () => {
        const ajv = new Ajv({ strict: false });
        const manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'axiscare.capabilities.json'),
                'utf8'
            )
        );
        const schema = {
            type: 'object',
            required: [
                '$schema',
                'module',
                'package',
                'version',
                'auth',
                'objects',
            ],
            properties: {
                $schema: { const: 'capability-manifest/v0.1' },
                module: { type: 'string' },
                package: { type: 'string' },
                version: { type: 'string' },
                auth: { type: 'object' },
                objects: { type: 'object' },
            },
        };
        expect(ajv.validate(schema, manifest)).toBe(true);
    });
});
