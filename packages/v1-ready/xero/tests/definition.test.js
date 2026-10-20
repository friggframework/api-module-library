const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Xero Definition', () => {
    it('is an oauth2 module named xero wired to the Api class', () => {
        expect(Definition.moduleName).toBe('xero');
        expect(Definition.getName()).toBe('xero');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Xero');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('persists tokens on the credential and tenantId on the entity', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token', 'accessTokenExpire'],
            entity: ['tenantId'],
        });
    });

    it('exposes OAuth env keys in snake_case', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
        expect(Definition.env.redirect_uri).toMatch(/\/xero$/);
    });

    it('getToken exchanges the authorization code', async () => {
        const api = new Api({});
        let seen;
        api.getTokenFromCode = async (code) => {
            seen = code;
            return { access_token: 'a', refresh_token: 'r' };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            data: { code: 'auth-code' },
        });
        expect(seen).toBe('auth-code');
    });

    it('getEntityDetails selects tenant, sets it, and uses OrganisationID', async () => {
        const api = new Api({ access_token: 't' });
        api.getConnections = async () => [
            {
                id: 'conn-1',
                tenantId: 'ten-1',
                tenantType: 'ORGANISATION',
                tenantName: 'Artichoke Inc',
            },
        ];
        api.getOrganisation = async () => ({
            OrganisationID: 'org-uuid',
            Name: 'Artichoke Inc',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(api.tenantId).toBe('ten-1');
        expect(details.identifiers.externalId).toBe('org-uuid');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.tenantId).toBe('ten-1');
        expect(details.details.name).toBe('Artichoke Inc');
    });

    it('getEntityDetails honours an explicit callback tenantId', async () => {
        const api = new Api({ access_token: 't' });
        api.getConnections = async () => [
            { id: 'c1', tenantId: 'ten-a', tenantType: 'ORGANISATION', tenantName: 'A' },
            { id: 'c2', tenantId: 'ten-b', tenantType: 'ORGANISATION', tenantName: 'B' },
        ];
        api.getOrganisation = async () => ({
            OrganisationID: 'org-b',
            Name: 'B',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            { tenantId: 'ten-b' },
            {},
            'user-2'
        );
        expect(api.tenantId).toBe('ten-b');
        expect(details.details.tenantId).toBe('ten-b');
    });

    it('getEntityDetails throws when there are no connections', async () => {
        const api = new Api({ access_token: 't' });
        api.getConnections = async () => [];
        await expect(
            Definition.requiredAuthMethods.getEntityDetails(api, {}, {}, 'u')
        ).rejects.toThrow(/no tenant connections/i);
    });

    it('getCredentialDetails uses OrganisationID when tenant is set', async () => {
        const api = new Api({ access_token: 't', tenantId: 'ten-1' });
        api.getOrganisation = async () => ({ OrganisationID: 'org-uuid' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('org-uuid');
    });

    it('testAuthRequest calls getOrganisations (setting tenant if needed)', async () => {
        const api = new Api({ access_token: 't', tenantId: null });
        let called = false;
        api.getConnections = async () => [
            { id: 'c', tenantId: 'ten-1', tenantType: 'ORGANISATION' },
        ];
        api.getOrganisations = async () => {
            called = true;
            return { Organisations: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(api.tenantId).toBe('ten-1');
        expect(called).toBe(true);
    });

    it('requiredAuthMethods cover the schema-required set', () => {
        const methods = Definition.requiredAuthMethods;
        expect(typeof methods.getToken).toBe('function');
        expect(typeof methods.getEntityDetails).toBe('function');
        expect(typeof methods.getCredentialDetails).toBe('function');
        expect(typeof methods.testAuthRequest).toBe('function');
        expect(methods.apiPropertiesToPersist).toBeTruthy();
    });

    it('capability methods referenced in the manifest exist on Api', () => {
        const manifest = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, '..', 'xero.capabilities.json'),
                'utf8'
            )
        );
        const missing = Object.entries(manifest.capabilities)
            .map(([name, cap]) => ({ name, method: cap.method }))
            .filter(
                ({ method }) => typeof Api.prototype[method] !== 'function'
            );
        expect(missing).toEqual([]);
    });
});
