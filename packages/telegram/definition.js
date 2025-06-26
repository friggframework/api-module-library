require('dotenv').config();
const { Api } = require('./api.js');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Telegram',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // Telegram uses bot tokens directly, no OAuth flow
            return {
                access_token: api.bot_token,
                token_type: 'Bot'
            };
        },

        getEntityDetails: async function (api, userId) {
            const botInfo = await api.getMe();
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: botInfo.result.id.toString(), 
                    user: userId 
                },
                details: {
                    username: botInfo.result.username,
                    first_name: botInfo.result.first_name,
                    is_bot: botInfo.result.is_bot,
                    can_join_groups: botInfo.result.can_join_groups,
                    can_read_all_group_messages: botInfo.result.can_read_all_group_messages,
                    supports_inline_queries: botInfo.result.supports_inline_queries
                },
            };
        },

        apiPropertiesToPersist: {
            credential: ['bot_token'],
            entity: [],
        },

        getCredentialDetails: async function (api, userId) {
            const botInfo = await api.getMe();
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: botInfo.result.id.toString(), 
                    user: userId 
                },
                details: {
                    bot_token: api.bot_token
                },
            };
        },

        testAuthRequest: function (api) {
            return api.getMe();
        },
    },
    env: {
        bot_token: process.env.TELEGRAM_BOT_TOKEN,
    },
};

module.exports = { Definition };