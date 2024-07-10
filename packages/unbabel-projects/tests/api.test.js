require('dotenv').config();
const {Api} = require('../api');
const {Authenticator} = require('@friggframework/devtools');

describe('Unbabel Projects API Tests', () => {
    /* eslint-disable camelcase */
    const apiParams = {
        client_id: process.env.UNBABEL_PROJECTS_CLIENT_ID,
        username: process.env.UNBABEL_PROJECTS_USERNAME,
        password: process.env.UNBABEL_PROJECTS_PASSWORD,
        customer_id: process.env.UNBABEL_PROJECTS_CUSTOMER_ID,
    };
    /* eslint-enable camelcase */

    const api = new Api(apiParams);

    beforeAll(async () => {
        await api.getTokenFromUsernamePassword();
    });

    describe('OAuth Flow Tests', () => {
        it('Should generate a tokens', async () => {
            expect(api.access_token).not.toBeNull();
            expect(api.refresh_token).not.toBeNull();
        });
        it('Should be able to refresh the token', async () => {
            const oldToken = api.access_token;
            const oldRefreshToken = api.refresh_token;
            await api.refreshAccessToken({refresh_token: api.refresh_token});
            expect(api.access_token).toBeDefined();
            expect(api.access_token).not.toEqual(oldToken);
            expect(api.refresh_token).toBeDefined();
            expect(api.refresh_token).not.toEqual(oldRefreshToken);
        });
    });
    describe('Basic Identification Requests', () => {
        it('Should retrieve information about the user', async () => {
            const user = await api.getTokenIdentity();
            expect(user).toBeDefined();
        });
    });

    it('Test auth request', async () => {
        const {results: supportedExtensions} = await api.getSupportedExtensions();
        expect(supportedExtensions).toBeDefined();
        expect(supportedExtensions).toHaveProperty('length');
    });

    describe('Project Definition Requests', () => {
        let projectId;
        it('Should create the project', async () => {
            const projectDef = {
                "name": `test_project_${Date.now()}`,
                "pipeline_ids": ["3733936f-5a31-465d-9722-ae476659f3b7"],
                "requested_by": "michael.webber@lefthook.com"
            }
            const response = await api.createProject(projectDef);
            expect(response).toBeDefined();
            expect(response.status).toBe('created');
            projectId = response.id;
        });
        it('Should retrieve the project', async () => {
            const response = await api.getProject(projectId);
            expect(response).toBeDefined();
            expect(response.id).toBe(projectId);
        });
    })
});
