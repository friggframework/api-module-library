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
    modelName: 'Miro',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            
            if (!code) {
                throw new Error('Missing authorization code for Miro OAuth');
            }
            
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const userInfo = await api.getUserInfo();
            
            return {
                identifiers: {externalId: userInfo.id, user: userId},
                details: {
                    name: userInfo.name,
                    email: userInfo.email,
                    picture: userInfo.picture || '',
                    industry: userInfo.industry || '',
                    company: userInfo.company || '',
                    companySize: userInfo.companySize || '',
                    timeZone: userInfo.timeZone || '',
                    locale: userInfo.locale || '',
                    type: userInfo.type,
                    state: userInfo.state,
                    createdAt: userInfo.createdAt,
                    modifiedAt: userInfo.modifiedAt
                },
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'refresh_token', 'token_type', 'expires_in'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const userInfo = await api.getUserInfo();
            
            return {
                identifiers: {externalId: userInfo.id, user: userId},
                details: {
                    name: userInfo.name,
                    email: userInfo.email,
                    company: userInfo.company || '',
                    type: userInfo.type
                }
            };
        },
        testAuthRequest: async function (api) {
            return api.getUserInfo()
        },
    },
    env: {
        client_id: process.env.MIRO_CLIENT_ID,
        client_secret: process.env.MIRO_CLIENT_SECRET,
        scope: process.env.MIRO_SCOPE || 'boards:read boards:write',
        redirect_uri: `${process.env.REDIRECT_URI}/miro`,
    }
};

module.exports = {Definition};