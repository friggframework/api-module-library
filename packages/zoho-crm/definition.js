require('dotenv').config();
const {Api} = require('./api');
const {get} = require('@friggframework/core');
const config = require('./defaultConfig.json')

const Definition = {
    API: Api,
    getName: function() {
        return config.name
    },
    moduleName: config.name,
    requiredAuthMethods: {
        getToken: async function(api, params) {
            const code = get(params.data, 'code'); 
            await api.getTokenFromCode(code);
        },
	    apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const response = await api.listUsers({type: 'CurrentUser'});
            const currentUser = response.users[0];
            return {
                identifiers: {externalId: currentUser.id, user: userId},
                details: {},
            };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const response = await api.listUsers({type: 'CurrentUser'});
            const currentUser = response.users[0];
            return {
                identifiers: {externalId: currentUser.id, user: userId},
                details: {
                    name: currentUser.email
                },
            }
        },
        testAuthRequest: async function(api) {
            return  await api.listUsers();
        },
    },
    env: {
        client_id: process.env.ZOHO_CRM_CLIENT_ID,
        client_secret: process.env.ZOHO_CRM_CLIENT_SECRET,
        scope: process.env.ZOHO_CRM_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/zoho-crm`,
    }
};

module.exports = {Definition};