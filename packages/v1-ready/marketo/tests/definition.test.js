const fs = require('fs');
const path = require('path');
const { Definition } = require('../definition');
const { Api } = require('../api');

describe('Marketo Definition', () => {
    it('is an oauth2 client-credentials module named marketo wired to Api', () => {
        expect(Definition.moduleName).toBe('marketo');
        expect(Definition.getName()).toBe('marketo');
        expect(Definition.API).toBe(Api);
        expect(Definition.modelName).toBe('Marketo');
        expect(Definition.moduleName).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
    });

    it('exposes getAuthorizationRequirements for the credential form', () => {
        const api = new Api({});
        const reqs =
            Definition.requiredAuthMethods.getAuthorizationRequirements(api);
        expect(reqs.type).toBe('oauth2');
        expect(reqs.data.jsonSchema.required).toContain('munchkin_id');
        expect(reqs.data.jsonSchema.required).toContain('client_id');
        expect(reqs.data.jsonSchema.required).toContain('client_secret');
    });

    it('persists tokens, client credentials, and munchkin_id', () => {
        expect(Definition.requiredAuthMethods.apiPropertiesToPersist).toEqual({
            credential: [
                'access_token',
                'accessTokenExpire',
                'client_id',
                'client_secret',
            ],
            entity: ['munchkin_id'],
        });
    });

    it('setAuthParams wires munchkin_id and client credentials onto the api', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            munchkin_id: '123-ABC-456',
            client_id: 'cid',
            client_secret: 'csec',
        });
        expect(api.munchkin_id).toBe('123-ABC-456');
        expect(api.baseUrl).toBe('https://123-ABC-456.mktorest.com/rest');
        expect(api.client_id).toBe('cid');
        expect(api.client_secret).toBe('csec');
    });

    it('setAuthParams also accepts nested params.data', async () => {
        const api = new Api({});
        await Definition.requiredAuthMethods.setAuthParams(api, {
            data: {
                munchkin_id: '111-AAA-111',
                client_id: 'x',
                client_secret: 'y',
            },
        });
        expect(api.munchkin_id).toBe('111-AAA-111');
    });

    it('getToken calls getTokenFromClientCredentials after setAuthParams', async () => {
        const api = new Api({});
        let called = false;
        api.getTokenFromClientCredentials = async () => {
            called = true;
            return {
                access_token: 't',
                expires_in: 3600,
                scope: 'api@acme.com',
            };
        };
        await Definition.requiredAuthMethods.getToken(api, {
            munchkin_id: '123-ABC-456',
            client_id: 'cid',
            client_secret: 'csec',
        });
        expect(api.munchkin_id).toBe('123-ABC-456');
        expect(called).toBe(true);
    });

    it('getEntityDetails uses munchkin_id as externalId and scope as name', async () => {
        const api = new Api({ munchkin_id: '123-ABC-456' });
        const details = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            {},
            { scope: 'apis@acme.com' },
            'user-1'
        );
        expect(details.identifiers.externalId).toBe('123-ABC-456');
        expect(details.identifiers.userId).toBe('user-1');
        expect(details.details.name).toBe('apis@acme.com');
        expect(details.details.munchkin_id).toBe('123-ABC-456');
    });

    it('getCredentialDetails uses munchkin_id as externalId', async () => {
        const api = new Api({ munchkin_id: '555-BBB-555' });
        const details =
            await Definition.requiredAuthMethods.getCredentialDetails(
                api,
                'user-c'
            );
        expect(details.identifiers.externalId).toBe('555-BBB-555');
        expect(details.identifiers.userId).toBe('user-c');
    });

    it('testAuthRequest calls describeLeads', async () => {
        const api = new Api({});
        let called = false;
        api.describeLeads = async () => {
            called = true;
            return { success: true, result: [] };
        };
        await Definition.requiredAuthMethods.testAuthRequest(api);
        expect(called).toBe(true);
    });

    it('retains no Mongoose manager/credential/entity imports', () => {
        const defSrc = fs.readFileSync(
            path.join(__dirname, '..', 'definition.js'),
            'utf8'
        );
        const idxSrc = fs.readFileSync(
            path.join(__dirname, '..', 'index.js'),
            'utf8'
        );
        expect(defSrc).not.toMatch(/mongoose|ModuleManager|credential\.js/i);
        expect(idxSrc).not.toMatch(/Credential|Entity|ModuleManager/);
        expect(idxSrc).toMatch(/Api/);
        expect(idxSrc).toMatch(/Definition/);
    });
});
