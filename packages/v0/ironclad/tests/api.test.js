const { Api } = require('../api');
const config = require('../defaultConfig.json');
const { Definition } = require('../definition');
const nock = require('nock');

const api = new Api(Definition.env);

describe(`${config.label} API tests`, () => {
    describe('Base URL', () => {
        it('should allow localhost subdomain', async () => {
            const api = new Api({ ...Definition.env, subdomain: 'localhost' });
            expect(api.baseUrl).toEqual('https://localhost');
        });

        it('should have ironcladapp.com to baseUrl for non local envs', async () => {
            const api = new Api({ ...Definition.env, subdomain: 'preview' });
            expect(api.baseUrl).toEqual('https://preview.ironcladapp.com');
        });
    });

    describe('Constructor', () => {
        it('Should initialize with a proper authorizationUri', () => {
            const authUri = new URL(api.authorizationUri);
            expect(authUri).toHaveProperty('protocol', 'https:');
            expect(authUri.searchParams.get('client_id')).toBe(
                process.env.IRONCLAD_CLIENT_ID,
            );
            expect(authUri.searchParams.get('redirect_uri')).toBe(
                `${process.env.REDIRECT_URI}/ironclad`,
            );
            expect(authUri.searchParams.get('response_type')).toBe('code');
            expect(authUri.searchParams.get('scope')).toBe(
                process.env.IRONCLAD_SCOPE,
            );
        });
    });

    // **************************   User details  **********************************

    describe('Get user details', () => {
        it('Should call request userinfo to the proper URL', async () => {
            const mockResponse = require('./mocks/oauth/userinfo.json');

            const scope = nock(api.baseUrl)
                .get(api.URLs.userInfo)
                .reply(200, mockResponse);
            const response = await api.getUserDetails();
            expect(scope.isDone()).toBe(true);
            expect(response).toEqual(mockResponse);
        });
    });
});
