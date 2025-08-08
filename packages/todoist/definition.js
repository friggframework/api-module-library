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
    modelName: 'Todoist',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // Check for OAuth code
            const code = get(params.data, 'code');
            if (code) {
                return api.getTokenFromCode(code);
            }
            
            // Check for API token (direct authentication)
            const apiToken = get(params.data, 'apiToken') || get(params.data, 'api_token');
            if (apiToken) {
                return {
                    api_token: apiToken,
                    access_token: apiToken,
                    token_type: 'Bearer'
                };
            }
            
            // Check for OAuth access token
            const access_token = get(params.data, 'access_token');
            if (access_token) {
                return {
                    access_token: access_token,
                    token_type: 'Bearer'
                };
            }
            
            throw new Error('Missing required Todoist credentials: code, apiToken, or access_token');
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const user = await api.getUser();
            
            return {
                identifiers: {externalId: user.id.toString(), user: userId},
                details: {
                    name: user.full_name,
                    email: user.email,
                    avatar: user.avatar_big || user.avatar_medium || user.avatar_small,
                    timezone: user.timezone,
                    language: user.lang,
                    premium: user.is_premium,
                    karma: user.karma,
                    karma_trend: user.karma_trend,
                    date_format: user.date_format,
                    time_format: user.time_format,
                    sort_order: user.sort_order,
                    week_start: user.start_day
                },
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'api_token', 'token_type'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const user = await api.getUser();
            
            return {
                identifiers: {externalId: user.id.toString(), user: userId},
                details: {
                    name: user.full_name,
                    email: user.email,
                    timezone: user.timezone
                }
            };
        },
        testAuthRequest: async function (api) {
            return api.getUser()
        },
    },
    env: {
        client_id: process.env.TODOIST_CLIENT_ID,
        client_secret: process.env.TODOIST_CLIENT_SECRET,
        api_token: process.env.TODOIST_API_TOKEN,
        redirect_uri: `${process.env.REDIRECT_URI}/todoist`,
    }
};

module.exports = {Definition};