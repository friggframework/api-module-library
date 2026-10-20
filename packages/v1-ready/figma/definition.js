require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Figma is OAuth 2 (authorization code). Public OAuth apps require Figma
 * review before they can authorize end users; private apps are limited to the
 * team/org the app is associated with. Identity comes from GET /v1/me.
 *
 * Default scopes cover the core objects this module implements. Override via
 * FIGMA_SCOPE (space- or comma-separated).
 */
const DEFAULT_SCOPES = [
    'current_user:read',
    'file_content:read',
    'file_metadata:read',
    'file_comments:read',
    'file_comments:write',
    'projects:read',
    'folders:read',
    'folder_metadata:read',
    'webhooks:read',
    'webhooks:write',
].join(',');

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Figma',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) || get(params.data || {}, 'code', null);
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const me = await api.getMe();
            if (!me?.id) {
                throw new Error(
                    'Figma /v1/me did not return a user id. Response: ' +
                        JSON.stringify(me)
                );
            }
            return {
                identifiers: { externalId: String(me.id), userId },
                details: {
                    name: me.handle || me.email || String(me.id),
                    email: me.email,
                    img_url: me.img_url,
                },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const me = await api.getMe();
            if (!me?.id) {
                throw new Error(
                    'Figma /v1/me did not return a user id. Response: ' +
                        JSON.stringify(me)
                );
            }
            return {
                identifiers: { externalId: String(me.id), userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getMe();
        },
    },
    env: {
        client_id: process.env.FIGMA_CLIENT_ID,
        client_secret: process.env.FIGMA_CLIENT_SECRET,
        scope: process.env.FIGMA_SCOPE || DEFAULT_SCOPES,
        // Omit when unset so schema validation does not see the string "undefined/figma".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/figma`
            : undefined,
    },
};

module.exports = { Definition };
