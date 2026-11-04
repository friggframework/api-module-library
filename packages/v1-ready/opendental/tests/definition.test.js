const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('Open Dental Definition', () => {
    it('is an api-key module named opendental wired to the Api class', () => {
        expect(Definition.moduleName).toBe('opendental');
        expect(Definition.getName()).toBe('opendental');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('OpenDental');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes a dual-key apiKey authorization form', async () => {
        const reqs =
            await Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toEqual([
            'developerKey',
            'customerKey',
        ]);
        expect(reqs.data.uiSchema.developerKey['ui:widget']).toBe('password');
        expect(reqs.data.uiSchema.customerKey['ui:widget']).toBe('password');
    });

    it('persists developerKey and customerKey credentials', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['developerKey', 'customerKey'],
            entity: [],
        });
    });

    it('setAuthParams sets both keys and builds ODFHIR Authorization', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            developerKey: 'DEV1',
            customerKey: 'CUST1',
        });
        expect(api.developerKey).toBe('DEV1');
        expect(api.customerKey).toBe('CUST1');
        expect(api.api_key).toBe('ODFHIR DEV1/CUST1');
    });

    it('getEntityDetails fingerprints customerKey and uses PracticeTitle', async () => {
        const api = new Api({
            developerKey: 'd',
            customerKey: 'cust-abc',
        });
        api.getPreference = async (name) => {
            expect(name).toBe('PracticeTitle');
            return { PrefName: 'PracticeTitle', ValueString: 'Sunrise Dental' };
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe(sha256('cust-abc'));
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Sunrise Dental');
    });

    it('getEntityDetails falls back to fingerprint when preference fails', async () => {
        const api = new Api({
            developerKey: 'd',
            customerKey: 'cust-xyz',
        });
        api.getPreference = async () => {
            throw new Error('boom');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe(sha256('cust-xyz'));
        expect(details.details.name).toBe('Open Dental');
    });

    it('fingerprint is STABLE for the same key and UNIQUE across keys', async () => {
        const makeApi = (key) => {
            const api = new Api({ developerKey: 'd', customerKey: key });
            api.getPreference = async () => null;
            return api;
        };
        const idFor = async (key) =>
            (
                await Definition.requiredAuthMethods.getEntityDetails(
                    makeApi(key),
                    {},
                    {},
                    'u'
                )
            ).identifiers.externalId;

        expect(await idFor('office-A')).toBe(await idFor('office-A'));
        expect(await idFor('office-A')).not.toBe(await idFor('office-B'));
    });

    it('throws rather than returning a shared constant when nothing can be derived', async () => {
        const api = new Api({});
        api.customerKey = null;
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]opendental-account['"]/);
        expect(src).not.toMatch(/externalId:\s*['"]default['"]/);
    });

    it('contains no client-specific leftover names from the port source', () => {
        const root = path.join(__dirname, '..');
        const files = [
            'api.js',
            'definition.js',
            'index.js',
            'README.md',
        ].map((f) => fs.readFileSync(path.join(root, f), 'utf8'));
        const blob = files.join('\n');
        expect(blob).not.toMatch(/payjunction/i);
        expect(blob).not.toMatch(/lefthookhq/i);
    });

    it('testAuthRequest performs an authenticated preferences call', async () => {
        const api = new Api({ developerKey: 'd', customerKey: 'c' });
        let called = false;
        api.listPreferences = async () => {
            called = true;
            return [];
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('env reads OPENDENTAL_DEVELOPER_KEY and OPENDENTAL_CUSTOMER_KEY', () => {
        expect(Object.keys(Definition.env)).toEqual([
            'developerKey',
            'customerKey',
        ]);
    });
});
