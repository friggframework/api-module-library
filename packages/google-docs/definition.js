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
    modelName: 'GoogleDocs',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            // Create a test document to verify access
            const testDoc = await api.createDocument('Test Document');
            return {
                identifiers: {externalId: testDoc.documentId || 'google-docs-account', user: userId},
                details: {name: 'Google Docs Account', service: 'Google Docs'},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'refresh_token'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            return {
                identifiers: {externalId: 'google-docs-account', user: userId},
                details: {service: 'Google Docs'}
            };
        },
        testAuthRequest: async function (api) {
            return api.createDocument('Auth Test Document')
        },
    },
    env: {
        client_id: process.env.GOOGLE_DOCS_CLIENT_ID,
        client_secret: process.env.GOOGLE_DOCS_CLIENT_SECRET,
        scope: process.env.GOOGLE_DOCS_SCOPE || 'https://www.googleapis.com/auth/documents',
        redirect_uri: `${process.env.REDIRECT_URI}/google-docs`,
    }
};

module.exports = {Definition};