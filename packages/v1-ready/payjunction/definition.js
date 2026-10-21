require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve the connected PayJunction merchant for entity/credential identity.
 * Prefer GET /merchant `id` (Pj-Merchant UUID used in webhook headers).
 *
 * @see https://developer.payjunction.com/hc/en-us/articles/12090782110619-GET-merchant
 * @see https://developer.payjunction.com/hc/en-us/articles/360007196134-Webhook-HTTP-Headers
 */
async function resolveMerchantIdentity(api) {
    const merchant = await api.getMerchant();
    const externalId =
        merchant?.id != null
            ? String(merchant.id)
            : merchant?.merchantId != null
              ? String(merchant.merchantId)
              : null;
    if (!externalId) {
        throw new Error(
            'PayJunction: cannot derive a stable merchant identity — GET /merchant returned no id.'
        );
    }
    const name =
        merchant.companyDba ||
        merchant.companyLegal ||
        merchant.companyName ||
        externalId;
    return { externalId, name, merchant };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'PayJunction',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) ||
                get(params.data || {}, 'code', null) ||
                params;
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveMerchantIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveMerchantIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'app_key',
            ],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getMerchant();
        },
        getAuthorizationRequirements: (api) => {
            if (api && typeof api.getAuthorizationRequirements === 'function') {
                return api.getAuthorizationRequirements();
            }
            return {
                url: api ? api.getAuthorizationUri() : null,
                type: 'oauth2',
            };
        },
    },
    env: {
        client_id: process.env.PAYJUNCTION_CLIENT_ID,
        client_secret: process.env.PAYJUNCTION_CLIENT_SECRET,
        app_key: process.env.PAYJUNCTION_APP_KEY,
        scope: process.env.PAYJUNCTION_SCOPE || 'read write',
        redirect_uri:
            process.env.PAYJUNCTION_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/payjunction`
                : undefined),
    },
};

module.exports = { Definition };
