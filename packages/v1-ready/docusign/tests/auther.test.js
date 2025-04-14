const {connectToDatabase, disconnectFromDatabase, createObjectId, Auther} = require('@friggframework/core');
const {testAutherDefinition} = require('@friggframework/devtools');
const {Authenticator} = require('@friggframework/test');
// Adjust definition import if build process places JS file elsewhere or handles TS directly
// If definition.ts is compiled to dist/definition.js, use require('../dist/definition')
// For now, assuming direct use or Jest transformation handles it:
const { Definition } = require('../dist/definition');

// Mocks specific to DocuSign
const mocks = {
    // DocuSign /userinfo endpoint response structure
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
    // DocuSign /token endpoint response structure
    tokenResponse: {
        access_token: 'mock-docusign-access-token',
        refresh_token: 'mock-docusign-refresh-token',
        token_type: 'Bearer',
        expires_in: 28800, // 8 hours typical for DocuSign
    },
    // Mock of incoming callback parameters after authorization redirect
    authorizeResponse: {
        base: '/redirect/docusign', // Example redirect path
        data: {
            code: 'mock-docusign-auth-code',
            state: 'mock-state',
        },
    }
};

// Test the Definition structure using mocks (Api methods will need mocking if tested directly)
// Note: testAutherDefinition expects Api methods to exist or be mocked.
// If Definition calls api methods (like getTokenFromCode), those need mocking setup
// similar to the previous auth.test.ts vi.mock block, but using Jest mocks.
// Since we are just replicating the structure for now, we proceed.
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
            const requirements = module.getAuthorizationRequirements();

            // Option 1: Use Authenticator (if it works for DocuSign and your setup)
             const response = await Authenticator.oauth2(requirements.url);
             const code = response.data.code;

            // Option 2: Replace with manual code pasting
            // const code = 'PASTE_MANUAL_CODE_HERE';
            // expect(code).not.toBe('PASTE_MANUAL_CODE_HERE');

            firstRes = await module.processAuthorizationCallback({
                data: { code: code },
            });
            expect(firstRes).toBeDefined();
            expect(firstRes.entity_id).toBeDefined();
            expect(firstRes.credential_id).toBeDefined();
        }, 60000); // Increased timeout for manual step

        // Skipped test similar to HubSpot example
        // it.skip('retrieves existing entity on subsequent calls', async () => {
        //     // Requires re-authenticating manually or using Authenticator again
        //     const response = await Authenticator.oauth2(authUrl);
        //     const res = await module.processAuthorizationCallback({
        //         data: {
        //             code: response.data.code,
        //         },
        //     });
        //     expect(res).toEqual(firstRes);
        // });
    });

    // describe('Test credential retrieval and module instantiation', () => {
    //     it('retrieve by entity id', async () => {
    //         expect(module.entity).toBeDefined();
    //         expect(module.entity.id).toBeDefined();
    //         const newModule = await Auther.getInstance({
    //             userId: module.userId,
    //             entityId: module.entity.id,
    //             definition: Definition,
    //         });
    //         expect(newModule).toBeDefined();
    //         expect(newModule.entity).toBeDefined();
    //         expect(newModule.credential).toBeDefined();
    //         // Use the testAuth method which triggers Definition.requiredAuthMethods.testAuthRequest
    //         const testResult = await newModule.testAuth();
    //         expect(testResult).toBeDefined();
    //          // Add more specific checks based on DocuSign /userinfo data
    //         expect(testResult.sub).toBeDefined();
    //     });

    //     it('retrieve by credential id', async () => {
    //         expect(module.credential).toBeDefined();
    //         expect(module.credential.id).toBeDefined();
    //         const newModule = await Auther.getInstance({
    //             userId: module.userId,
    //             credentialId: module.credential.id,
    //             definition: Definition,
    //         });
    //         expect(newModule).toBeDefined();
    //         expect(newModule.credential).toBeDefined();
    //         const testResult = await newModule.testAuth();
    //         expect(testResult).toBeDefined();
    //         expect(testResult.sub).toBeDefined();
    //     });
    // });
}); 