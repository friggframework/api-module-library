const {connectToDatabase, disconnectFromDatabase, createObjectId, Auther} = require('@friggframework/core');
const {testAutherDefinition} = require('@friggframework/devtools');
const {Authenticator} = require('@friggframework/test');
const {Definition} = require('../definition');


const mocks = {
    getUserDetails: {
        "id": "<id>",
        "first_name": "Jane",
        "last_name": "Doe",
        "display_name": "Jane Doe",
        "email": "jane.doe@lefthook.com",
        "type": 1,
        "role_name": "Owner",
        "pmi": 0,
        "use_pmi": false,
        "personal_meeting_url": "https://us04web.zoom.us/j/redacted?pwd=redacted",
        "timezone": "",
        "verified": 0,
        "dept": "",
        "created_at": "2023-07-26T14:16:21Z",
        "last_login_time": "2024-06-26T15:58:30Z",
        "last_client_version": "5.17.11.34827(win)",
        "pic_url": "https://us04web.zoom.us/p/v2/",
        "cms_user_id": "",
        "jid": "test@xmpp.zoom.us",
        "group_ids": [],
        "im_group_ids": [],
        "account_id": "<account_id>",
        "language": "en-US",
        "phone_country": "",
        "phone_number": "",
        "status": "active",
        "job_title": "",
        "location": "",
        "login_types": [
            1
        ],
        "role_id": "0",
        "cluster": "us04",
        "user_created_at": "2023-07-26T14:16:21Z"
    },
    tokenResponse: {
        "access_token": "redacted",
        "token_type": "bearer",
        "refresh_token": "redacted",
        "expires_in": 3599,
        "scope": "user:read:user user:read:email meeting:read:list_meetings meeting:write:meeting meeting:update:meeting"
    },
    authorizeResponse: {
        "base": "/redirect/zoom",
        "data": {
            "code": "test-code",
            "state": "null"
        }
    }
}

testAutherDefinition(Definition, mocks)

describe.skip('Zoom Module Live Tests', () => {
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
            expect(requirements.type).toEqual('oauth2');
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
        });
        it('retrieves existing entity on subsequent calls', async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const response = await Authenticator.oauth2(authUrl);
            const res = await module.processAuthorizationCallback({
                data: {
                    code: response.data.code,
                },
            });
            expect(res).toEqual(firstRes);
        });
        it('refresh the token', async () => {
            module.api.access_token = 'foobar';
            const res = await module.testAuth();
            expect(res).toBeTruthy();
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
