const { Definition } = require('./definition');
const mongoose = require('mongoose');
const config = require('./defaultConfig.json');
const { Api } = require('./api');

describe(`Should fully test the ${config.label} Definition`, () => {
    let api;

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGO_URI);
        api = new Api();
    });

    afterAll(async () => {
        await mongoose.disconnect();
    });

    it('should return the correct name', () => {
        const name = Definition.getName();
        expect(name).toEqual(config.name);
    });

    it('should return the token from code', async () => {
        const params = {
            data: {
                code: 'sample_code',
            },
        };
        api.getTokenFromCode = jest.fn().mockResolvedValue('mocked_token');
        const token = await Definition.requiredAuthMethods.getToken(api, params);
        expect(token).toEqual('mocked_token');
    });

    it('should return the correct entity details', async () => {
        const userId = new mongoose.Types.ObjectId();
        const callbackParams = {};
        const tokenResponse = {};
        const mockUserDetails = {
            portalId: 'mock_portal_id',
            hub_domain: 'mock_hub_domain',
        };
        api.getUserDetails = jest.fn().mockResolvedValue(mockUserDetails);

        const entityDetails = await Definition.requiredAuthMethods.getEntityDetails(
            api,
            callbackParams,
            tokenResponse,
            userId
        );

        expect(entityDetails.identifiers.externalId).toEqual(mockUserDetails.portalId);
        expect(entityDetails.identifiers.user).toEqual(userId);
        expect(entityDetails.details.name).toEqual(mockUserDetails.hub_domain);
    });

    it('should return the correct credential details', async () => {
        const userId = new mongoose.Types.ObjectId();
        const mockUserDetails = {
            portalId: 'mock_portal_id',
        };
        api.getUserDetails = jest.fn().mockResolvedValue(mockUserDetails);

        const credentialDetails = await Definition.requiredAuthMethods.getCredentialDetails(
            api,
            userId
        );

        expect(credentialDetails.identifiers.externalId).toEqual(mockUserDetails.portalId);
        expect(credentialDetails.identifiers.user).toEqual(userId);
        expect(credentialDetails.details).toEqual({});
    });

    it('should test the authentication request', async () => {
        const mockUserDetails = {
            portalId: 'mock_portal_id',
            hub_domain: 'mock_hub_domain',
        };
        api.getUserDetails = jest.fn().mockResolvedValue(mockUserDetails);

        const testAuth = await Definition.requiredAuthMethods.testAuthRequest(api);

        expect(testAuth).toEqual(mockUserDetails);
    });
});