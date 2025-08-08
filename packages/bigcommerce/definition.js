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
    modelName: 'BigCommerce',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // For OAuth flow
            const code = get(params.data, 'code');
            const context = get(params.data, 'context');
            const scope = get(params.data, 'scope');
            
            if (code && context && scope) {
                // OAuth flow
                const tokenResponse = await api.getTokenFromCode(code, context, scope);
                return {
                    access_token: tokenResponse.access_token,
                    scope: tokenResponse.scope,
                    context: tokenResponse.context,
                    user: tokenResponse.user,
                    store_hash: context.replace('stores/', ''),
                    token_type: 'Bearer'
                };
            }
            
            // Direct access token
            const accessToken = get(params.data, 'access_token') || get(params.data, 'accessToken');
            const storeHash = get(params.data, 'store_hash') || get(params.data, 'storeHash');
            
            if (!accessToken || !storeHash) {
                throw new Error('Missing required BigCommerce credentials: access_token and store_hash');
            }
            
            return {
                access_token: accessToken,
                store_hash: storeHash,
                token_type: 'Bearer'
            };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const storeInfo = await api.getStoreInfo();
            
            return {
                identifiers: {externalId: storeInfo.secure_url, user: userId},
                details: {
                    name: storeInfo.name,
                    domain: storeInfo.domain,
                    secure_url: storeInfo.secure_url,
                    store_hash: api.storeHash,
                    plan_name: storeInfo.plan_name,
                    currency: storeInfo.currency,
                    timezone: storeInfo.timezone?.name
                },
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'store_hash', 'scope', 'context', 'user'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const storeInfo = await api.getStoreInfo();
            
            return {
                identifiers: {externalId: storeInfo.secure_url, user: userId},
                details: {
                    name: storeInfo.name,
                    domain: storeInfo.domain,
                    store_hash: api.storeHash
                }
            };
        },
        testAuthRequest: async function (api) {
            return api.getStoreInfo()
        },
    },
    env: {
        client_id: process.env.BIGCOMMERCE_CLIENT_ID,
        client_secret: process.env.BIGCOMMERCE_CLIENT_SECRET,
        access_token: process.env.BIGCOMMERCE_ACCESS_TOKEN,
        store_hash: process.env.BIGCOMMERCE_STORE_HASH,
        redirect_uri: `${process.env.REDIRECT_URI}/bigcommerce`,
    }
};

module.exports = {Definition};