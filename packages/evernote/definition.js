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
    modelName: 'Evernote',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // Evernote uses OAuth 1.0a, so the flow is different
            const oauth_token = get(params.data, 'oauth_token');
            const oauth_verifier = get(params.data, 'oauth_verifier');
            
            if (!oauth_token || !oauth_verifier) {
                throw new Error('Missing required Evernote OAuth parameters: oauth_token and oauth_verifier');
            }
            
            // In a real implementation, you'd need to store the request token secret from the initial request
            const requestTokenSecret = get(params.data, 'oauth_token_secret');
            if (!requestTokenSecret) {
                throw new Error('Missing oauth_token_secret from initial OAuth request');
            }
            
            return api.getAccessToken(oauth_token, requestTokenSecret, oauth_verifier);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const user = await api.getUser();
            const noteStoreUrl = await api.getNoteStoreUrl();
            
            return {
                identifiers: {externalId: user.id.toString(), user: userId},
                details: {
                    name: user.name,
                    username: user.username,
                    email: user.email || '',
                    timezone: user.timezone,
                    privilege: user.privilege,
                    serviceLevel: user.serviceLevel,
                    created: user.created,
                    updated: user.updated,
                    noteStoreUrl: noteStoreUrl,
                    webApiUrlPrefix: user.webApiUrlPrefix || tokenResponse.edam_webApiUrlPrefix
                },
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'oauth_token_secret', 'noteStoreUrl', 'webApiUrlPrefix'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const user = await api.getUser();
            
            return {
                identifiers: {externalId: user.id.toString(), user: userId},
                details: {
                    name: user.name,
                    username: user.username,
                    email: user.email || '',
                    serviceLevel: user.serviceLevel
                }
            };
        },
        testAuthRequest: async function (api) {
            return api.getUser()
        },
    },
    env: {
        client_id: process.env.EVERNOTE_CLIENT_ID,
        client_secret: process.env.EVERNOTE_CLIENT_SECRET,
        sandbox: process.env.EVERNOTE_SANDBOX === 'true',
        redirect_uri: `${process.env.REDIRECT_URI}/evernote`,
    }
};

module.exports = {Definition};