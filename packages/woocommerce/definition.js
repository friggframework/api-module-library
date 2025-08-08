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
    modelName: 'WooCommerce',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // WooCommerce uses Consumer Key/Secret, not OAuth tokens
            const consumer_key = get(params.data, 'consumer_key');
            const consumer_secret = get(params.data, 'consumer_secret');
            const baseUrl = get(params.data, 'baseUrl');
            
            if (!consumer_key || !consumer_secret || !baseUrl) {
                throw new Error('Missing required WooCommerce credentials: consumer_key, consumer_secret, and baseUrl');
            }
            
            return {
                consumer_key,
                consumer_secret,
                baseUrl,
                access_token: consumer_key, // Store as access_token for compatibility
                token_type: 'consumer_key'
            };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            // Get store information to identify the entity
            const systemStatus = await api.getSystemStatus();
            const settings = await api.getSettingsByGroup('general');
            
            const storeTitle = settings.find(s => s.id === 'woocommerce_store_name')?.value || 'WooCommerce Store';
            const storeUrl = api.baseUrl;
            
            return {
                identifiers: {externalId: storeUrl, user: userId},
                details: {
                    name: storeTitle,
                    url: storeUrl,
                    version: systemStatus.wc_version || 'Unknown'
                },
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'consumer_key', 'consumer_secret', 'baseUrl', 'access_token'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const systemStatus = await api.getSystemStatus();
            const settings = await api.getSettingsByGroup('general');
            
            const storeTitle = settings.find(s => s.id === 'woocommerce_store_name')?.value || 'WooCommerce Store';
            
            return {
                identifiers: {externalId: api.baseUrl, user: userId},
                details: {
                    name: storeTitle,
                    version: systemStatus.wc_version || 'Unknown'
                }
            };
        },
        testAuthRequest: async function (api) {
            return api.getSystemStatus()
        },
    },
    env: {
        consumer_key: process.env.WOOCOMMERCE_CONSUMER_KEY,
        consumer_secret: process.env.WOOCOMMERCE_CONSUMER_SECRET,
        baseUrl: process.env.WOOCOMMERCE_BASE_URL,
    }
};

module.exports = {Definition};