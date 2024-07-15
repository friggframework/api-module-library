const {mongoose} = require('@friggframework/core');
require('dotenv').config();
const Manager = require('../manager');
const {Authenticator} = require('@friggframework/devtools');


const apiParams = {
    client_id: process.env.UNBABEL_PROJECTS_CLIENT_ID,
    username: process.env.UNBABEL_PROJECTS_USERNAME,
    password: process.env.UNBABEL_PROJECTS_PASSWORD,
    customer_id: process.env.UNBABEL_PROJECTS_CUSTOMER_ID,
};

describe('Unbabel Projects Manager Tests', () => {
    let manager, authUrl;
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGO_URI);
        manager = await Manager.getInstance({
            userId: new mongoose.Types.ObjectId(),
        });
    });

    afterAll(async () => {
        await Manager.Credential.deleteMany();
        await Manager.Entity.deleteMany();
        await mongoose.disconnect();
    });

    describe('getAuthorizationRequirements() test', () => {
        it('should return auth requirements', async () => {
            const requirements = manager.getAuthorizationRequirements();
            expect(requirements).toBeDefined();
            expect(requirements.type).toEqual('oauth2');
            expect(requirements.url).toBeDefined();
            authUrl = requirements.url;
        });
    });

    describe('Authorization requests', () => {
        let firstRes;
        it('processAuthorizationCallback()', async () => {
            firstRes = await manager.processAuthorizationCallback({
                ...apiParams
            });
            expect(firstRes).toBeDefined();
            expect(firstRes.entity_id).toBeDefined();
            expect(firstRes.credential_id).toBeDefined();
        });
        it('processAuthorizationCallback()', async () => {
            const res = await manager.processAuthorizationCallback({
                ...apiParams
            });
            expect(res).toEqual(firstRes);
        });

        it('get new token via refresh', async () => {
            manager.api.access_token = 'foobar';
            const response = await manager.testAuth();
            expect(response).toBeTruthy();
            expect(manager.api.access_token).not.toEqual('foobar');
        });
    });
    describe('Test credential retrieval and manager instantiation', () => {
        it('retrieve by entity id', async () => {
            const newManager = await Manager.getInstance({
                userId: manager.userId,
                entityId: manager.entity.id,
            });
            expect(newManager).toBeDefined();
            expect(newManager.entity).toBeDefined();
            expect(newManager.credential).toBeDefined();
        });

        it('retrieve by credential id', async () => {
            const newManager = await Manager.getInstance({
                userId: manager.userId,
                credentialId: manager.credential.id,
            });
            expect(newManager).toBeDefined();
            expect(newManager.credential).toBeDefined();
        });
    });
});
