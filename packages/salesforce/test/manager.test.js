const {Authenticator} = require('@friggframework/test');
const {mongoose} = require('@friggframework/core');
require('dotenv').config();
const Manager = require('../manager');
const config = require('../defaultConfig.json');

describe(`Should fully test the ${config.label} Manager`, () => {
    let manager, userManager;

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

    it('getAuthorizationRequirements() should return auth requirements', async () => {
        const requirements = await manager.getAuthorizationRequirements();
        expect(requirements).toBeDefined();
        expect(requirements.type).toBe('oauth2');
        authUrl = requirements.url;
    });
    describe('processAuthorizationCallback()', () => {
        it('should return auth details', async () => {
            const response = await Authenticator.oauth2(authUrl);
            const baseArr = response.base.split('/');
            response.entityType = baseArr[baseArr.length - 1];
            delete response.base;

            const authRes = await manager.processAuthorizationCallback({
                data: {
                    code: response.data.code,
                },
            });
            expect(authRes).toBeDefined();
            expect(authRes).toHaveProperty('entity_id');
            expect(authRes).toHaveProperty('credential_id');
            expect(authRes).toHaveProperty('type');
        });
        it('should refresh token', async () => {
            manager.api.conn.accessToken = 'nope';
            await manager.testAuth();
            expect(manager.api.conn.accessToken).not.toBe('nope');
            expect(manager.api.conn.accessToken).toBeDefined();
        });
        it('should refresh token after a fresh database retrieval', async () => {
            const newManager = await Manager.getInstance({
                userId: manager.userId,
                entityId: manager.entity.id,
            });
            newManager.api.conn.accessToken = 'nope';
            await newManager.testAuth();
            expect(newManager.api.conn.accessToken).not.toBe('nope');
            expect(newManager.api.conn.accessToken).toBeDefined();
        });
        it('should error if incorrect auth data', async () => {
            try {
                const authRes = await manager.processAuthorizationCallback({
                    data: {
                        code: 'bad',
                    },
                });
                expect(authRes).not.toBeDefined()
            } catch (e) {
                expect(e.message).toContain('Error Authing with Code');
            }
        });
    });
});
