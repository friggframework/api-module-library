const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('RollWorks Definition', () => {
    it('is an oauth2 module named rollworks wired to the Api class', () => {
        expect(Definition.moduleName).toBe('rollworks');
        expect(Definition.getName()).toBe('rollworks');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('RollWorks');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes oauth2 authorization requirements with the authorize URL', () => {
        const api = new Api({
            client_id: 'cid',
            redirect_uri: 'https://app.example/redirect/rollworks',
            scope: 'all',
        });
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.url).toContain('services.adroll.com/auth/authorize');
    });

    it('persists OAuth tokens on the credential and advertisable_eid on the entity', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: ['access_token', 'refresh_token'],
            entity: ['advertisable_eid'],
        });
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

    it('getEntityDetails uses the organization eid as externalId', async () => {
        const api = new Api({});
        api.getOrganization = async () => ({
            results: { eid: 'ORG-EID', name: 'Acme Org' },
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('ORG-EID');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('Acme Org');
    });

    it('getEntityDetails also accepts an unwrapped organization payload', async () => {
        const api = new Api({});
        api.getOrganization = async () => ({
            eid: 'ORG-FLAT',
            name: 'Flat Org',
        });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            {},
            'user-2'
        );
        expect(details.identifiers.externalId).toBe('ORG-FLAT');
    });

    it('getCredentialDetails uses the organization eid', async () => {
        const api = new Api({});
        api.getOrganization = async () => ({
            results: { eid: 'ORG-CRED', name: 'Cred Org' },
        });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('ORG-CRED');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls getOrganization', async () => {
        const api = new Api({});
        let called = false;
        api.getOrganization = async () => {
            called = true;
            return { eid: 'x' };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('declares the expected OAuth env keys', () => {
        expect(Definition.env).toHaveProperty('client_id');
        expect(Definition.env).toHaveProperty('client_secret');
        expect(Definition.env).toHaveProperty('scope');
        expect(Definition.env).toHaveProperty('redirect_uri');
    });

    it('retains no mongoose manager/models in the package', () => {
        const root = path.join(__dirname, '..');
        expect(fs.existsSync(path.join(root, 'manager.js'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'models'))).toBe(false);
    });
});
