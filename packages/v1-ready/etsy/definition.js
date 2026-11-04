require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Etsy Open API v3 Definition — OAuth 2.0 Authorization Code + PKCE.
 *
 * Identity: GET /users/me → shop_id (preferred) or user_id; shop name from
 * GET /shops/{shop_id} when available.
 *
 * Env (dedicated redirect URI per module brief):
 *   ETSY_KEYSTRING, ETSY_SHARED_SECRET, ETSY_SCOPE, ETSY_REDIRECT_URI
 *
 * Docs: https://developers.etsy.com/documentation/essentials/authentication
 */
async function resolveAccountIdentity(api) {
    const me = await api.getMe();
    const shopId = me?.shop_id;
    const userId = me?.user_id;
    const externalId = shopId != null ? String(shopId) : userId != null ? String(userId) : null;
    if (!externalId) {
        throw new Error(
            'Etsy: GET /users/me returned no shop_id or user_id — cannot derive a stable entity identifier. Response: ' +
                JSON.stringify(me)
        );
    }

    let name = 'Etsy';
    if (shopId != null) {
        try {
            const shop = await api.getShop(shopId);
            if (shop?.shop_name) name = shop.shop_name;
            api.setShopId(shopId);
        } catch (e) {
            // shop name is best-effort; identity still uses shop_id/user_id
        }
    }
    if (userId != null) {
        api.etsy_user_id = String(userId);
    }
    return { externalId, name, shopId, userId };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Etsy',
    requiredAuthMethods: {
        getAuthorizationRequirements: function () {
            const api =
                this.api ||
                new Api({
                    client_id: Definition.env.client_id,
                    client_secret: Definition.env.client_secret,
                    redirect_uri: Definition.env.redirect_uri,
                    scope: Definition.env.scope,
                });
            return api.getAuthorizationRequirements();
        },
        getToken: async function (api, params) {
            const data = (params && params.data) || {};
            const code =
                get(params, 'code', null) || get(data, 'code', null);
            const state =
                get(params, 'state', null) || get(data, 'state', null);
            const explicitVerifier =
                get(params, 'code_verifier', null) ||
                get(data, 'code_verifier', null);

            let verifier = explicitVerifier;
            if (!verifier && state) {
                verifier = api.restoreVerifierFromState(state);
            }
            return api.getTokenFromCode(code, verifier);
        },
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            if (tokenResponse) {
                api._captureUserIdFromToken(tokenResponse);
            }
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    shopId: identity.shopId,
                    etsyUserId: identity.userId,
                },
            };
        },
        getCredentialDetails: async function (api, userId) {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        testAuthRequest: async function (api) {
            return api.getMe();
        },
    },
    env: {
        client_id: process.env.ETSY_KEYSTRING,
        client_secret: process.env.ETSY_SHARED_SECRET,
        scope: process.env.ETSY_SCOPE,
        redirect_uri: process.env.ETSY_REDIRECT_URI,
    },
};

module.exports = { Definition };
