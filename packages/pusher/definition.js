require('dotenv').config();
const { Api } = require('./api.js');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Pusher',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // Pusher uses API key/secret authentication
            return {
                access_token: api.key,
                token_type: 'Key'
            };
        },

        getEntityDetails: async function (api, userId) {
            const stats = await api.getApplicationStats();
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: api.app_id, 
                    user: userId 
                },
                details: {
                    app_id: api.app_id,
                    cluster: api.cluster,
                    channel_count: stats.channel_count,
                    useTLS: api.useTLS
                },
            };
        },

        apiPropertiesToPersist: {
            credential: ['key', 'secret'],
            entity: ['app_id', 'cluster'],
        },

        getCredentialDetails: async function (api, userId) {
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: api.app_id, 
                    user: userId 
                },
                details: {
                    key: api.key,
                    secret: api.secret
                },
            };
        },

        testAuthRequest: function (api) {
            return api.testConnection();
        },
    },
    env: {
        app_id: process.env.PUSHER_APP_ID,
        key: process.env.PUSHER_KEY,
        secret: process.env.PUSHER_SECRET,
        cluster: process.env.PUSHER_CLUSTER || 'us2',
        useTLS: process.env.PUSHER_USE_TLS !== 'false',
    },
};

module.exports = { Definition };