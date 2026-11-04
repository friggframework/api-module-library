require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Copper CRM is API-key authenticated via three request headers
 * (X-PW-AccessToken, X-PW-Application, X-PW-UserEmail). Identity comes from
 * GET /account → account.id / account.name.
 *
 * Credential fields: api_key + user_email.
 *
 * Partner OAuth 2.0 (Authorization Code, scope `developer/v1/all`) is
 * documented at https://developer.copper.com/introduction/oauth/flow.html
 * but requires registering with partners@copper.com — not wired here.
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Copper',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Copper CRM Authentication',
                    type: 'object',
                    required: ['api_key', 'user_email'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                        user_email: {
                            type: 'string',
                            title: 'User Email',
                            description:
                                'Email address of the Copper user who generated the API key.',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Generate an API key in Copper under System settings > API Keys. Sent as the X-PW-AccessToken header.',
                    },
                    user_email: {
                        'ui:help':
                            'Must be the email of the token owner. Sent as the X-PW-UserEmail header on every request.',
                        'ui:placeholder': 'you@example.com',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'apiKey', null) ||
                get(params, 'access_token', null) ||
                get(data, 'api_key', null) ||
                get(data, 'apiKey', null) ||
                get(data, 'access_token', null);
            const userEmail =
                get(params, 'user_email', null) ||
                get(params, 'userEmail', null) ||
                get(params, 'email', null) ||
                get(data, 'user_email', null) ||
                get(data, 'userEmail', null) ||
                get(data, 'email', null);

            if (apiKey) {
                api.setApiKey(apiKey);
            }
            if (userEmail) {
                api.setUserEmail(userEmail);
            }
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const account = await api.getAccount();
            if (!account || account.id === undefined || account.id === null) {
                throw new Error(
                    'Copper GET /account failed to return a valid account id. ' +
                        'Response: ' +
                        JSON.stringify(account)
                );
            }
            return {
                identifiers: {
                    externalId: String(account.id),
                    userId,
                },
                details: {
                    name: account.name || 'Copper',
                    primary_timezone: account.primary_timezone,
                },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const account = await api.getAccount();
            if (!account || account.id === undefined || account.id === null) {
                throw new Error(
                    'Copper GET /account failed to return a valid account id. ' +
                        'Response: ' +
                        JSON.stringify(account)
                );
            }
            return {
                identifiers: {
                    externalId: String(account.id),
                    userId,
                },
                details: {
                    user_email: api.user_email,
                },
            };
        },
        apiPropertiesToPersist: {
            credential: ['api_key', 'user_email'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getAccount();
        },
    },
    env: {
        api_key: process.env.COPPER_API_KEY,
        // Schema allows fixed keys + UPPER_SNAKE custom keys. Api constructor
        // also accepts `user_email` / `USER_EMAIL` so the env value wires through.
        USER_EMAIL: process.env.COPPER_USER_EMAIL,
    },
};

module.exports = { Definition };
