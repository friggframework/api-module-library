const {connectToDatabase, disconnectFromDatabase, createObjectId, Auther} = require('@friggframework/core');
//require('dotenv').config();
const {Definition} = require('../definition');
const {Authenticator} = require('@friggframework/devtools');
describe('Freshbooks Auther Tests', () => {
    let manager, authUrl;
    beforeAll(async () => {
        await connectToDatabase();
        manager = await Auther.getInstance({
            definition: Definition,
            userId: createObjectId(),
        });
    });

    afterAll(async () => {
        await manager.CredentialModel.deleteMany();
        await manager.EntityModel.deleteMany();
        await disconnectFromDatabase();
    });

    describe('getAuthorizationRequirements() test', () => {
        it('should return auth requirements', async () => {
            const requirements = manager.getAuthorizationRequirements({redirect_uri: manager.api.redirect_uri});
            expect(requirements).toBeDefined();
            expect(requirements.type).toEqual('oauth2');
            expect(requirements.url).toBeDefined();
            authUrl = encodeURI(requirements.url);
        });
    });

    describe('Authorization requests', () => {
        let firstRes;
        it('processAuthorizationCallback()', async () => {
            const response = await Authenticator.oauth2(authUrl);
            firstRes = await manager.processAuthorizationCallback({
                data: {
                    code: response.data.code,
                },
            });
            expect(firstRes).toBeDefined();
            expect(firstRes.entity_id).toBeDefined();
            expect(firstRes.credential_id).toBeDefined();
        });
        it.skip('retrieves existing entity on subsequent calls', async () => {
            const response = await Authenticator.oauth2(authUrl);
            const res = await manager.processAuthorizationCallback({
                data: {
                    code: response.data.code,
                },
            });
            expect(res).toEqual(firstRes);
        });
    });
    describe('Test credential retrieval and manager instantiation', () => {
        it('retrieve by entity id', async () => {
            const newManager = await Auther.getInstance({
                userId: manager.userId,
                entityId: manager.entity.id,
                definition: Definition,
            });
            expect(newManager).toBeDefined();
            expect(newManager.entity).toBeDefined();
            expect(newManager.credential).toBeDefined();
            expect(await newManager.testAuth()).toBeTruthy();
        });

        it('retrieve by credential id', async () => {
            const newManager = await Auther.getInstance({
                userId: manager.userId,
                credentialId: manager.credential.id,
                definition: Definition,
            });
            expect(newManager).toBeDefined();
            expect(newManager.credential).toBeDefined();
            expect(await newManager.testAuth()).toBeTruthy();
        });
    });
});
