require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Canva Connect uses OAuth 2.0 authorization code + PKCE (S256).
 * Identity comes from GET /v1/users/me (`team_user.user_id` / `team_id`),
 * with OIDC /v1/oidc/userinfo as a fallback when openid scopes are granted.
 *
 * Docs: https://www.canva.dev/docs/connect/authentication/
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Canva',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const data = params?.data || params || {};
            const code =
                get(params, 'code', null) ||
                get(data, 'code', null);
            const codeVerifier =
                get(params, 'code_verifier', null) ||
                get(data, 'code_verifier', null) ||
                api.code_verifier;
            return api.getTokenFromCode(code, codeVerifier);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const user = await api.getUserDetails();
            const externalId = String(user.user_id || user.id || user.sub);
            if (!externalId) {
                throw new Error(
                    'Canva: usersMe/userInfo did not return a stable user id.'
                );
            }
            return {
                identifiers: { externalId, userId },
                details: {
                    name: user.name || user.display_name || externalId,
                    email: user.email,
                    team_id: user.team_id,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const user = await api.getUserDetails();
            const externalId = String(user.user_id || user.id || user.sub);
            if (!externalId) {
                throw new Error(
                    'Canva: cannot derive credential identity — no user id from usersMe/userInfo.'
                );
            }
            return {
                identifiers: { externalId, userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
            ],
            entity: ['team_id'],
        },

        testAuthRequest: async (api) => {
            return api.usersMe();
        },
    },
    env: {
        client_id: process.env.CANVA_CLIENT_ID,
        client_secret: process.env.CANVA_CLIENT_SECRET,
        scope:
            process.env.CANVA_SCOPE ||
            'openid profile email profile:read design:meta:read design:content:read design:content:write folder:read folder:write asset:read asset:write collaboration:event',
        redirect_uri: `${process.env.REDIRECT_URI}/canva`,
        base_url: process.env.CANVA_BASE_URL,
    },
};

module.exports = { Definition };
