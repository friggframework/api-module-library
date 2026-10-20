require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

/**
 * Intercom OAuth module Definition.
 *
 * Identity: GET /me returns the authorized admin plus the embedded workspace
 * (`app.id_code`). That workspace id_code is the stable externalId for entity
 * + credential — not the admin id (re-install by another admin must not fork
 * a new entity).
 *
 * @see https://developers.intercom.com/docs/references/rest-api/api.intercom.io/admins/identifyadmin
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Intercom',
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
        redirect_uri: `${process.env.REDIRECT_URI}/intercom`,
        base_url: process.env.INTERCOM_BASE_URL,
    },
};

module.exports = { Definition };
