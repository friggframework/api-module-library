require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Canva Connect uses OAuth 2.0 authorization code + PKCE (S256).
 *
 * Identity (ported from Left Hook v1 canva-connect Manager):
 *   getTokenIdentity() → POST /v1/oauth/introspect → `sub` as externalId.
 * Enriched with GET /v1/users/me team_user when available.
 *
 * Docs: https://www.canva.dev/docs/connect/authentication/
 * Prior art: lefthookhq/canva--frigg (private) Api/Manager.
 */
const DEFAULT_SCOPE =
    'openid profile email profile:read design:meta:read design:content:read design:content:write folder:read folder:write asset:read asset:write comment:read comment:write brandtemplate:meta:read collaboration:event';

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Canva',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const data = params?.data || params || {};
            const code =
                get(params, 'code', null) || get(data, 'code', null);
            const codeVerifier =
                get(params, 'code_verifier', null) ||
                get(data, 'code_verifier', null) ||
                api.code_verifier;
            // v1: getTokenFromCodeVerifier(code) using api.code_verifier
            return api.getTokenFromCode(code, codeVerifier);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            // v1 Manager used getTokenIdentity().identifier (introspect sub).
            const user = await api.getUserDetails();
            const externalId = String(
                user.sub || user.user_id || user.id || user.identifier
            );
            if (!externalId) {
                throw new Error(
                    'Canva: could not derive externalId from introspect sub / usersMe.'
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
            const externalId = String(
                user.sub || user.user_id || user.id || user.identifier
            );
            if (!externalId) {
                throw new Error(
                    'Canva: cannot derive credential identity — no introspect sub / usersMe id.'
                );
            }
            return {
                identifiers: { externalId, userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            // v1 Credential model: access_token, refresh_token, expires_at
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
            ],
            entity: ['team_id'],
        },

        testAuthRequest: async (api) => {
            // v1 Manager.testAuth used listFolderItems('root'); usersMe is a
            // lighter identity probe that does not require folder:read.
            return api.usersMe();
        },
    },
    env: {
        // Prefer CANVA_*; fall back to v1 CANVA_CONNECT_* names.
        client_id:
            process.env.CANVA_CLIENT_ID ||
            process.env.CANVA_CONNECT_CLIENT_ID,
        client_secret:
            process.env.CANVA_CLIENT_SECRET ||
            process.env.CANVA_CONNECT_CLIENT_SECRET,
        scope:
            process.env.CANVA_SCOPE ||
            process.env.CANVA_CONNECT_SCOPE ||
            DEFAULT_SCOPE,
        // Omit when unset so schema validation does not see the string "undefined/canva".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/canva`
            : undefined,
        base_url: process.env.CANVA_BASE_URL,
    },
};

module.exports = { Definition };
