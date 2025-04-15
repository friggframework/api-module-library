const {connectToDatabase, disconnectFromDatabase, createObjectId, Auther} = require('@friggframework/core');
const {testAutherDefinition} = require('@friggframework/devtools');
const {Authenticator} = require('@friggframework/test');
const { Definition } = require('../dist/definition');

const mocks = {
    getUserDetails: {
        sub: 'user-sub-12345',
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        created: '2024-01-01T00:00:00.000Z',
        email: 'test.user@example.com',
        accounts: [
            {
                account_id: 'account-id-default-67890',
                is_default: true,
                account_name: 'Test Default Account',
                base_uri: 'https://demo.docusign.net',
            },
            {
                account_id: 'account-id-other-11221',
                is_default: false,
                account_name: 'Test Other Account',
                base_uri: 'https://demo.docusign.net',
            },
        ],
    },
    tokenResponse: {
        access_token: 'mock-docusign-access-token',
        refresh_token: 'mock-docusign-refresh-token',
        token_type: 'Bearer',
        expires_in: 28800, // 8 hours typical for DocuSign
    },
    authorizeResponse: {
        base: '/redirect/docusign',
        data: {
            code: 'mock-docusign-auth-code',
            state: 'mock-state',
        },
    }
};


testAutherDefinition(Definition, mocks);


describe('DocuSign Module Live Tests', () => {
    let module, authUrl;
    beforeAll(async () => {
        await connectToDatabase();
        module = await Auther.getInstance({
            definition: Definition,
            userId: createObjectId(),
        });
    });

    afterAll(async () => {
        if (module && module.CredentialModel) await module.CredentialModel.deleteMany();
        if (module && module.EntityModel) await module.EntityModel.deleteMany();
        await disconnectFromDatabase();
    });

    describe('getAuthorizationRequirements() test', () => {
        it('should return auth requirements', async () => {
            const requirements = module.getAuthorizationRequirements();
            expect(requirements).toBeDefined();
            expect(requirements.type).toEqual('oauth2');
            expect(requirements.url).toBeDefined();
            authUrl = requirements.url;
            console.log('Follow this URL to authorize:', authUrl);
        });
    });

    describe('Authorization requests', () => {
        let firstRes;
        it('processAuthorizationCallback()', async () => {
            const response = await Authenticator.oauth2(authUrl);

            firstRes = await module.processAuthorizationCallback({
                data: { code: response.data.code },
            });
            expect(firstRes).toBeDefined();
            expect(firstRes.entity_id).toBeDefined();
            expect(firstRes.credential_id).toBeDefined();
        }, 60000); // Increased timeout for manual step

        it('retrieves existing entity on subsequent calls', async () => {
            const response = await Authenticator.oauth2(authUrl);
            const res = await module.processAuthorizationCallback({
                data: { code: response.data.code },
            });
            expect(res).toEqual(firstRes);
        }, 30000);
    });

    describe('Test credential retrieval and module instantiation', () => {
        it('retrieve by entity id', async () => {
            expect(module.entity).toBeDefined();
            expect(module.entity.id).toBeDefined();
            const newModule = await Auther.getInstance({
                definition: Definition,
                userId: module.userId,
                entityId: module.entity.id,
            });
            expect(newModule).toBeDefined();
            expect(newModule.entity).toBeDefined();
            expect(newModule.credential).toBeDefined();
            // Use the testAuth method which triggers Definition.requiredAuthMethods.testAuthRequest
            const testResult = await newModule.testAuth();
            expect(testResult).toBe(true);
        });

        it('retrieve by credential id', async () => {
            expect(module.credential).toBeDefined();
            expect(module.credential.id).toBeDefined();
            const newModule = await Auther.getInstance({
                userId: module.userId,
                credentialId: module.credential.id,
                definition: Definition,
            });
            expect(newModule).toBeDefined();
            expect(newModule.credential).toBeDefined();
            const testResult = await newModule.testAuth();
            expect(testResult).toBe(true);
        });
    });
}); 