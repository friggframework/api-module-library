const {connectToDatabase, disconnectFromDatabase, createObjectId, Auther} = require('@friggframework/core');
const {testAutherDefinition} = require('@friggframework/devtools');
const {Authenticator} = require('@friggframework/test');
const {Definition} = require('../definition');

const mocks = {
    find: [
        {
        'Name': 'test-organization',
        'Id': 'test-organization-id',
    }],
    getUserInfo: {
        Username: 'test@example.com'
    },
    getAuthorizationUri: 'https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=redacted&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fredirect%2Fsalesforce',
    getAccessToken: async function() {
        await this.setTokens({
            "token_type": "bearer",
            "refresh_token": "test-refresh-token",
            "access_token": "test-access-token",
            "expires_in": 1800
        });
        return 'token_string'
    },
    tokenResponse: {
        "token_type": "bearer",
        "refresh_token": "test-refresh-token",
        "access_token": "test-access-token",
        "expires_in": 1800
    },
    authorizeResponse: {
        "base": "/redirect/salesforce",
        "data": {
            "code": "test-code",
            "state": "null"
        }
    }
}

testAutherDefinition(Definition, mocks)

describe.skip('Salesforce Module Live Tests', () => {
    let module, authUrl;
    beforeAll(async () => {
        await connectToDatabase();
        module = await Auther.getInstance({
            definition: Definition,
            userId: createObjectId(),
        });
    });

    afterAll(async () => {
        await module.CredentialModel.deleteMany();
        await module.EntityModel.deleteMany();
        await disconnectFromDatabase();
    });

    describe('getAuthorizationRequirements() test', () => {
        it('should return auth requirements', async () => {
            const requirements = await module.getAuthorizationRequirements();
            expect(requirements).toBeDefined();
            expect(requirements).toHaveProperty('type');
            expect(requirements.type).toBe('oauth2');
            expect(requirements.url).toBeDefined();
            authUrl = requirements.url;
        });
    });

    describe('Authorization requests', () => {
        let firstRes;
        it('processAuthorizationCallback()', async () => {
            const response = await Authenticator.oauth2(authUrl);
            firstRes = await module.processAuthorizationCallback({
                data: {
                    code: response.data.code,
                },
            });
            expect(firstRes).toBeDefined();
            expect(firstRes.entity_id).toBeDefined();
            expect(firstRes.credential_id).toBeDefined();
            expect(await module.testAuth()).toBeTruthy();

        });
        it('check refresh token', async () => {
            module.api.conn.accessToken = 'nope';
            await module.testAuth();
            expect(module.api.conn.accessToken).not.toBe('nope');
            expect(module.api.conn.accessToken).toBeDefined();
        })
        it.skip('retrieves existing entity on subsequent calls', async () => {
            const response = await Authenticator.oauth2(authUrl);
            const res = await module.processAuthorizationCallback({
                data: {
                    code: response.data.code,
                },
            });
            expect(res).toEqual(firstRes);
        });
    });
    describe('Test credential retrieval and module instantiation', () => {
        it('retrieve by entity id', async () => {
            const newModule = await Auther.getInstance({
                userId: module.userId,
                entityId: module.entity.id,
                definition: Definition,
            });
            expect(newModule).toBeDefined();
            expect(newModule.entity).toBeDefined();
            expect(newModule.credential).toBeDefined();
            expect(await newModule.testAuth()).toBeTruthy();

        });

        it('retrieve by credential id', async () => {
            const newModule = await Auther.getInstance({
                userId: module.userId,
                credentialId: module.credential.id,
                definition: Definition,
            });
            expect(newModule).toBeDefined();
            expect(newModule.credential).toBeDefined();
            expect(await newModule.testAuth()).toBeTruthy();

        });
    });
});
