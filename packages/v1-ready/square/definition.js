require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve the connected Square merchant for entity/credential identity.
 * Prefer RetrieveMerchant("me"); fall back to merchant_id from the token
 * response when the profile call is unavailable.
 */
async function resolveMerchantIdentity(api, tokenResponse) {
    try {
        const result = await api.retrieveMerchant('me');
        const merchant = result?.merchant;
        if (merchant?.id) {
            return {
                externalId: merchant.id,
                name: merchant.business_name || merchant.id,
            };
        }
    } catch (e) {
        // fall through
    }

    const merchantId =
        get(tokenResponse || {}, 'merchant_id', null) || api.merchant_id;
    if (merchantId) {
        return { externalId: merchantId, name: merchantId };
    }

    throw new Error(
        'Square: cannot derive a stable merchant identity — RetrieveMerchant("me") failed and no merchant_id is available from the token response.'
    );
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Square',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) || get(params.data || {}, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveMerchantIdentity(api, tokenResponse);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveMerchantIdentity(api, null);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token', 'merchant_id'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.retrieveMerchant('me');
        },
    },
    env: {
        client_id: process.env.SQUARE_CLIENT_ID,
        client_secret: process.env.SQUARE_CLIENT_SECRET,
        scope: process.env.SQUARE_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/square`,
        base_url: process.env.SQUARE_BASE_URL,
    },
};

module.exports = { Definition };
