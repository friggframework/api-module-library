const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Airtable Definition', () => {
    it('is an oauth2 module named airtable wired to the Api class', () => {
        expect(Definition.moduleName).toBe('airtable');
        expect(Definition.getName()).toBe('airtable');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Airtable');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements with a URL', () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'csecret',
            redirect_uri: 'https://app.example/redirect/airtable',
            scope: 'data.records:read',
            state: 'callerState',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('https://airtable.com/oauth2/v1/authorize');
        expect(reqs.url).toContain('code_challenge_method=S256');
        expect(reqs.url).toContain('code_challenge=');
    });

    it('persists access_token and refresh_token', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: [],
        });
    });

    it('getToken restores PKCE verifier from state then exchanges the code', async () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'csecret',
            redirect_uri: 'https://app.example/redirect/airtable',
        });
        const url = api.getAuthorizationUri();
        const state = new URL(url).searchParams.get('state');
        let captured;
        api.getTokenFromCode = async (code) => {
            captured = { code, verifier: api.code_verifier };
            return { access_token: 'a', refresh_token: 'r' };
        };
        // Simulate a fresh Api instance that only has state from the callback.
        const api2 = new Api({
            client_id: 'cid',
            client_secret: 'csecret',
            redirect_uri: 'https://app.example/redirect/airtable',
        });
        api2.getTokenFromCode = async (code) => {
            captured = { code, verifier: api2.code_verifier };
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api2, {
            code: 'auth-code',
            state,
        });
        expect(captured.code).toBe('auth-code');
        expect(captured.verifier).toBeTruthy();
        expect(captured.verifier).toBe(api.code_verifier);
    });

    it('getEntityDetails uses whoami id and snapshots base ids', async () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'sec',
            access_token: 'tok',
        });
        api.getWhoami = async () => ({
            id: 'usrABC',
            email: 'dev@example.com',
        });
        api.listBases = async () => ({
            bases: [
                { id: 'app1', name: 'One' },
                { id: 'app2', name: 'Two' },
            ],
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('usrABC');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('dev@example.com');
        expect(details.details.baseIds).toEqual(['app1', 'app2']);
    });

    it('getCredentialDetails uses whoami id', async () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'sec',
            access_token: 'tok',
        });
        api.getWhoami = async () => ({ id: 'usrXYZ' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('usrXYZ');
    });

    it('throws when whoami has no id', async () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'sec',
            access_token: 'tok',
        });
        api.getWhoami = async () => ({});
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/stable account identity/i);
    });

    it('testAuthRequest calls getWhoami', async () => {
        const api = new Api({
            client_id: 'cid',
            client_secret: 'sec',
            access_token: 'tok',
        });
        let called = false;
        api.getWhoami = async () => {
            called = true;
            return { id: 'usr1' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('moduleName matches the api-module-definition schema pattern', () => {
        // From packages/schemas/schemas/api-module-definition.schema.json
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
        expect(fs.existsSync(path.join(__dirname, '..', 'definition.js'))).toBe(
            true
        );
    });
});
