require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

/**
 * Intercom OAuth module Definition.
 *
 * Auth: OAuth 2.0 authorization-code for public / marketplace apps (primary).
 * Access token alternate: private apps may paste a workspace Access Token via
 * `setAuthParams({ access_token })` — same Bearer header as OAuth tokens.
 *
 * Identity: GET /me returns the authorized admin plus the embedded workspace
 * (`app.id_code`). That workspace id_code is the stable externalId for entity
 * + credential — not the admin id (re-install by another admin must not fork
 * a new entity).
 *
 * @see https://developers.intercom.com/docs/references/rest-api/api.intercom.io/admins/identifyadmin
 * @see https://developers.intercom.com/docs/build-an-integration/learn-more/authentication
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Intercom',
    // ADR-057: point at extensions.mapping (support@1 + business@1, UNVALIDATED).
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            if (!code) {
                throw new Error(
                    'Intercom OAuth callback missing authorization code'
                );
            }
            return api.getTokenFromCode(code);
        },

        /**
         * Access-token alternate for private apps / PATs.
         * Prefer OAuth `getToken` for marketplace installs.
         */
        setAuthParams: async (api, params) => {
            const token =
                get(params, 'access_token', null) ||
                get(params, 'api_key', null) ||
                get(params, 'token', null);
            if (!token) {
                throw new Error(
                    'Intercom setAuthParams requires access_token (workspace Access Token)'
                );
            }
            api.setAccessToken(token);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const me = await api.getMe();
            const workspaceId = me?.app?.id_code;
            if (!workspaceId) {
                throw new Error(
                    'Intercom /me did not return app.id_code — cannot derive entity externalId'
                );
            }
            return {
                identifiers: { externalId: String(workspaceId), userId },
                details: {
                    name: me.app?.name || me.name || String(workspaceId),
                    region: me.app?.region || null,
                    adminId: me.id ? String(me.id) : null,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const me = await api.getMe();
            const workspaceId = me?.app?.id_code;
            if (!workspaceId) {
                throw new Error(
                    'Intercom /me did not return app.id_code — cannot derive credential externalId'
                );
            }
            return {
                identifiers: { externalId: String(workspaceId), userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            // Intercom OAuth does not issue refresh tokens.
            credential: ['access_token'],
            entity: [],
        },

        testAuthRequest: async (api) => api.getMe(),
    },
    env: {
        client_id: process.env.INTERCOM_CLIENT_ID,
        client_secret: process.env.INTERCOM_CLIENT_SECRET,
        // Omit when unset so schema validation does not see the string "undefined/intercom".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/intercom`
            : undefined,
        base_url: process.env.INTERCOM_BASE_URL,
        // Optional private-app Access Token (Bearer alternate to OAuth).
        access_token: process.env.INTERCOM_ACCESS_TOKEN,
    },
};

module.exports = { Definition };
