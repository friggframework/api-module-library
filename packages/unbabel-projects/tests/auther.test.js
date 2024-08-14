require('dotenv').config();
const {connectToDatabase, disconnectFromDatabase, createObjectId, Auther} = require('@friggframework/core');
const {testAutherDefinition} = require('@friggframework/devtools');
const {Definition} = require('../definition');

const testAuthData = {
    client_id: process.env.UNBABEL_PROJECTS_CLIENT_ID,
    username: process.env.UNBABEL_PROJECTS_USERNAME,
    password: process.env.UNBABEL_PROJECTS_PASSWORD,
    customer_id: process.env.UNBABEL_PROJECTS_CUSTOMER_ID
};

const mocks = {
    authorizeParams: {
        data: {
            username: 'redacted',
            password: 'redacted',
            customer_id: 'redacted'
        }
    },
    tokenResponse: {
        access_token: 'redacted',
        refresh_token: 'redacted'
    },
    getSupportedExtensions: {
        results: []
    }
}

testAutherDefinition(Definition, mocks);

describe('Unbabel Module Tests', () => {
    let module;
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

    describe('Authorization requests', () => {
        it('processAuthorizationCallback()', async () => {
            const authRes = await module.processAuthorizationCallback({
                data: testAuthData,
            });
            expect(authRes).toBeDefined();
            expect(authRes).toHaveProperty('entity_id');
            expect(authRes).toHaveProperty('credential_id');
            expect(authRes).toHaveProperty('type');
        });
    });

    it('getAuthorizationRequirements() should return auth requirements', async () => {
        const requirements = await module.getAuthorizationRequirements();
        expect(requirements).toBeDefined();
        expect(requirements.type).toEqual('oauth2');
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
