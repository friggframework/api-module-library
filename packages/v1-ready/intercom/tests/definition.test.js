const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Intercom Definition', () => {
    it('is an oauth2 module named intercom wired to the Api class', () => {
        expect(Definition.moduleName).toBe('intercom');
        expect(Definition.getName()).toBe('intercom');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Intercom');
    });

    it('exposes oauth2 authorization requirements via the Api', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example/redirect/intercom',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('/oauth?');
    });

    it('persists only the access_token credential (no refresh token)', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token'],
            entity: [],
        });
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 't' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'abc' },
        });
        expect(seen).toBe('abc');
    });

    it('getToken throws when code is missing', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.getToken(api, { data: {} })
        ).rejects.toThrow(/authorization code/i);
    });

    it('getEntityDetails uses workspace id_code from /me', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({
            type: 'admin',
            id: '99',
            name: 'Hermione',
            app: {
                type: 'app',
                id_code: 'drzzt019',
                name: 'Hogwarts workspace',
                region: 'US',
            },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('drzzt019');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Hogwarts workspace');
        expect(details.details.region).toBe('US');
        expect(details.details.adminId).toBe('99');
    });

    it('getEntityDetails throws when app.id_code is missing', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({ type: 'admin', id: '1', name: 'X' });
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/id_code/i);
    });

    it('getCredentialDetails uses the same workspace id_code', async () => {
        const api = new Api({ access_token: 't' });
        api.getMe = async () => ({
            id: '1',
            app: { id_code: 'ws_abc', name: 'Acme' },
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('ws_abc');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getMe', async () => {
        const api = new Api({ access_token: 't' });
        let called = false;
        api.getMe = async () => {
            called = true;
            return { id: '1', app: { id_code: 'x' } };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('omits redirect_uri when REDIRECT_URI is unset', () => {
        expect(Definition.env.redirect_uri).toBe(
            process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/intercom`
                : undefined
        );
    });

    it('setAuthParams accepts a workspace access_token alternate', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            access_token: 'pat-token',
        });
        expect(api.access_token).toBe('pat-token');
    });

    it('setAuthParams throws when no token is provided', async () => {
        const api = new Api({});
        await expect(
            Definition.requiredAuthMethods.setAuthParams(api, {})
        ).rejects.toThrow(/access_token/i);
    });

    it('declares ADR-057 mappings for support and business', () => {
        expect(Definition.mappings).toEqual({
            support: 'extensions.mapping',
            business: 'extensions.mapping',
        });
    });
});

