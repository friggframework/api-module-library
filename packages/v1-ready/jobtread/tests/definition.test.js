const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

const sha256 = (v) =>
    crypto.createHash('sha256').update(String(v)).digest('hex');

describe('JobTread Definition', () => {
    it('is an api-key module named jobtread wired to the Api class', () => {
        expect(Definition.moduleName).toBe('jobtread');
        expect(Definition.getName()).toBe('jobtread');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('JobTread');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes an apiKey authorization form for the grant_key field', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('apiKey');
        expect(reqs.data.jsonSchema.required).toContain('grant_key');
        expect(reqs.data.jsonSchema.properties.grant_key.type).toBe('string');
        expect(reqs.data.uiSchema.grant_key['ui:widget']).toBe('password');
    });

    it('persists only the grant_key credential', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['grant_key'],
            entity: [],
        });
    });

    it('setAuthParams sets the grant key from form params', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            grant_key: 'grant_form',
        });
        expect(api.grant_key).toBe('grant_form');
        expect(api.api_key).toBe('grant_form');
    });

    it('getEntityDetails derives externalId from currentGrant.organization.id', async () => {
        const api = new Api({ grant_key: 'k' });
        api.getCurrentGrant = async () => ({
            currentGrant: {
                id: 'grant1',
                organization: { id: 'org-99', name: 'Left Hook Builders' },
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('org-99');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Left Hook Builders');
    });

    it('getEntityDetails falls back to grant id when organization is missing', async () => {
        const api = new Api({ grant_key: 'k' });
        api.getCurrentGrant = async () => ({
            currentGrant: { id: 'grant-only', name: 'CI Grant' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('grant-only');
        expect(details.details.name).toBe('CI Grant');
    });

    it('getEntityDetails falls back to the grant-key fingerprint when the API throws', async () => {
        const api = new Api({ grant_key: 'key-boom' });
        api.getCurrentGrant = async () => {
            throw new Error('boom');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-3'
        );
        expect(details.identifiers.externalId).toBe(sha256('key-boom'));
    });

    it('fingerprint fallback is STABLE for the same key and UNIQUE across keys', async () => {
        const makeApi = (key) => {
            const api = new Api({ grant_key: key });
            api.getCurrentGrant = async () => ({ currentGrant: null });
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

        expect(await idFor('cust-A-key')).toBe(await idFor('cust-A-key'));
        expect(await idFor('cust-A-key')).not.toBe(await idFor('cust-B-key'));
    });

    it('throws rather than returning a shared constant when nothing can be derived', async () => {
        const api = new Api({});
        api.grant_key = null;
        api.api_key = null;
        api.getCurrentGrant = async () => ({ currentGrant: null });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('retains NO hardcoded constant fallback in the source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/externalId:\s*['"]jobtread-account['"]/);
    });

    it('testAuthRequest performs getCurrentGrant', async () => {
        const api = new Api({ grant_key: 'k' });
        let called = false;
        api.getCurrentGrant = async () => {
            called = true;
            return { currentGrant: { id: 'g' } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });
});
