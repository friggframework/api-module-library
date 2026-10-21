const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Covetrus Definition', () => {
    it('is a covetrus module wired to the Api class', () => {
        expect(Definition.moduleName).toBe('covetrus');
        expect(Definition.getName()).toBe('covetrus');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Covetrus');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements', () => {
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements();
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('auth.covetrus.com/oauth/authorize');
    });

    it('persists OAuth tokens and practice/location entity fields', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
            ],
            entity: ['practiceId', 'locationId'],
        });
    });

    it('env uses dedicated COVETRUS_REDIRECT_URI when set', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });

    it('getEntityDetails uses practice.id as externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.getPractice = async () => ({
            id: 42,
            name: 'Downtown Vet',
            phone: '555-0100',
        });
        api.listLocations = async () => ({
            data: [{ id: 'loc_1', name: 'Main Clinic' }],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('42');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Downtown Vet');
        expect(details.details.locationName).toBe('Main Clinic');
        expect(details.details.phone).toBe('555-0100');
    });

    it('getEntityDetails still works when listLocations throws', async () => {
        const api = new Api({ access_token: 't' });
        api.getPractice = async () => ({ id: 'prac_9', name: 'Only Practice' });
        api.listLocations = async () => {
            throw new Error('scope denied');
        };
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('prac_9');
        expect(details.details.name).toBe('Only Practice');
        expect(details.details.locationName).toBeUndefined();
    });

    it('getEntityDetails throws when practice has no id', async () => {
        const api = new Api({ access_token: 't' });
        api.getPractice = async () => ({ name: 'no-id' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable entity identifier/i);
    });

    it('getCredentialDetails matches entity externalId', async () => {
        const api = new Api({ access_token: 't' });
        api.getPractice = async () => ({ id: 'prac_cred', name: 'Cred Vet' });
        api.listLocations = async () => ({ data: [] });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('prac_cred');
        expect(details.details.name).toBe('Cred Vet');
    });

    it('testAuthRequest calls getPractice', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getPractice = async () => {
            called = true;
            return { id: 'p' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('getToken exchanges the code via api.getTokenFromCode', async () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'sec',
        });
        let saw;
        api.getTokenFromCode = async (code) => {
            saw = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        const res = await Definition.requiredAuthMethods.getToken(api, {
            code: 'auth-code',
        });
        expect(saw).toBe('auth-code');
        expect(res.access_token).toBe('a');
    });

    it('getToken accepts nested params.data.code', async () => {
        const api = new Api({});
        let saw;
        api.getTokenFromCode = async (code) => {
            saw = code;
            return { access_token: 'a' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'nested-code' },
        });
        expect(saw).toBe('nested-code');
    });

    it('retains no client-company names in definition source', () => {
        const src = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        expect(src).not.toMatch(/payjunction/i);
        expect(src).not.toMatch(/lefthookhq/i);
    });
});
