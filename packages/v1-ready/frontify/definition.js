require('dotenv').config();
const {Api} = require('./api');
const {get} = require("@friggframework/core");
const config = require('./defaultConfig.json')

const Definition = {
    API: Api,
    getName: function () {
        return config.name
    },
    moduleName: config.name,
    modelName: 'Frontify',
    requiredAuthMethods: {
        getAuthorizationRequirements: async function (api) {
            return {
                url: api.getAuthUri(),
                type: 'oauth2',
                data: {
                    jsonSchema: {
                        title: 'Auth Form',
                        type: 'object',
                        required: ['domain'],
                        properties: {
                            domain: {
                                type: 'string',
                                title: 'Your Frontify Domain',
                            }
                        }
                    },
                    uiSchema: {
                        domain: {
                            'ui:help':
                                'A Frontify domain, e.g: lefthook.frontify.com',
                            'ui:placeholder': 'Your Frontify domain...',
                        },
                    }
                }
            };
        },
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            const domain = get(params.data, 'domain');
            api.setDomain(domain);
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const {user: userDetails} = await api.getUser();
            return {
                identifiers: {externalId: userDetails.id, userId},
                details: {name: userDetails.name },
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'refresh_token', 'domain'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const {user: userDetails} = await api.getUser();
            return {
                identifiers: {externalId: userDetails.id, userId},
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return api.getUser()
        },
    },
    env: {
        client_id: process.env.FRONTIFY_CLIENT_ID,
        client_secret: process.env.FRONTIFY_CLIENT_SECRET,
        scope: process.env.FRONTIFY_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/frontify`,
    }
};

module.exports = {Definition};
