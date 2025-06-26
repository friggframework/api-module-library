require('dotenv').config();
const { Api } = require('./api.js');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'OneSignal',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // OneSignal uses REST API key authentication
            return {
                access_token: api.rest_api_key,
                token_type: 'Basic'
            };
        },

        getEntityDetails: async function (api, userId) {
            const appInfo = await api.getApp();
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: appInfo.id, 
                    user: userId 
                },
                details: {
                    name: appInfo.name,
                    players: appInfo.players,
                    messageable_players: appInfo.messageable_players,
                    updated_at: appInfo.updated_at,
                    created_at: appInfo.created_at,
                    gcm_key: appInfo.gcm_key ? 'configured' : 'not configured',
                    chrome_web_origin: appInfo.chrome_web_origin,
                    chrome_web_default_notification_icon: appInfo.chrome_web_default_notification_icon,
                    chrome_web_sub_domain: appInfo.chrome_web_sub_domain,
                    apns_env: appInfo.apns_env,
                    apns_certificates: appInfo.apns_certificates ? 'configured' : 'not configured'
                },
            };
        },

        apiPropertiesToPersist: {
            credential: ['rest_api_key', 'user_auth_key'],
            entity: ['app_id'],
        },

        getCredentialDetails: async function (api, userId) {
            const appInfo = await api.getApp();
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: appInfo.id, 
                    user: userId 
                },
                details: {
                    rest_api_key: api.rest_api_key,
                    user_auth_key: api.user_auth_key
                },
            };
        },

        testAuthRequest: function (api) {
            return api.getApp();
        },
    },
    env: {
        app_id: process.env.ONESIGNAL_APP_ID,
        rest_api_key: process.env.ONESIGNAL_REST_API_KEY,
        user_auth_key: process.env.ONESIGNAL_USER_AUTH_KEY,
    },
};

module.exports = { Definition };