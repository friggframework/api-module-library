require('dotenv').config();
const {Api} = require('../api');
const fs = require('fs');

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
            const response = await api.createProject(projectDef,  'https://webhook.site/3812d00d-ff11-4a91-a931-3ecb813fc90e');
            expect(response).toBeDefined();
            expect(response.status).toBe('created');
            projectId = response.id;
        });
        it('Should retrieve the project', async () => {
            const response = await api.getProject(projectId);
            expect(response).toBeDefined();
            expect(response.id).toBe(projectId);
        });
        let fileId;
        it('Should add a file to the project', async () => {
            const response = await api.addFileToProject(projectId, 'test.txt', 'test file','txt');
            expect(response).toBeDefined();
            expect(response.upload_url).toBeDefined();
            fileId = response.id;
        });
        it('Should upload file to the upload url', async () => {
            const response = await api.getFile(projectId, fileId);
            expect(response).toBeDefined();
            expect(response.upload_url).toBeDefined();
            const file = fs.readFileSync('tests/test.txt', 'utf8');
            const response2 = await api.uploadFile(response.upload_url, file);
            expect(response2).toBeDefined();
            expect(response2.status).toBe(200);
        });
        it('Should fetch a file to confirm upload', async () => {
            const response = await api.getFile(projectId, fileId);
            expect(response).toBeDefined();
            expect(response.download_url).toBeDefined();
        });
        it('Should submit the project', async () => {
            const response = await api.submitProject(projectId);
            expect(response).toBeDefined();
            expect(response.status).toBe(
                'submitted'
            );
        })
        it('Should delete the project', async () => {
            const response = await api.cancelProject(projectId);
            expect(response).toBeDefined();
            expect(response.status).toBe(200);
        });
    })

    describe.skip('Large File Test', () => {
        let projectId;
        it('Should create the project', async () => {
            const projectDef = {
                "name": `large_file_test_project_${Date.now()}`,
                "pipeline_ids": ["3733936f-5a31-465d-9722-ae476659f3b7"],
                "requested_by": "michael.webber@lefthook.com"
            }
            const response = await api.createProject(projectDef,  'https://webhook.site/3812d00d-ff11-4a91-a931-3ecb813fc90e');
            expect(response).toBeDefined();
            expect(response.status).toBe('created');
            projectId = response.id;
        });
        it('Should retrieve the project', async () => {
            const response = await api.getProject(projectId);
            expect(response).toBeDefined();
            expect(response.id).toBe(projectId);
        });
        let fileId;
        it('Should add a file to the project', async () => {
            const response = await api.addFileToProject(projectId, 'test.txt', 'test file','txt');
            expect(response).toBeDefined();
            expect(response.upload_url).toBeDefined();
            fileId = response.id;
        });
        it('Should upload file to the upload url', async () => {
            const response = await api.getFile(projectId, fileId);
            expect(response).toBeDefined();
            expect(response.upload_url).toBeDefined();
            const file = fs.readFileSync('tests/test.txt', 'utf8');
            const response2 = await api.uploadFile(response.upload_url, file.repeat(10000));
            const response3 = await api.submitProject(projectId);
            expect(response2).toBeDefined();
            expect(response2.status).toBe(200);
            expect(response3).toBeDefined();
            expect(response3.status).toBe(
                'submitted'
            );
        });
        it('Should delete the project', async () => {
            const response = await api.cancelProject(projectId);
            expect(response).toBeDefined();
            expect(response.status).toBe(200);
        });
    })
});
