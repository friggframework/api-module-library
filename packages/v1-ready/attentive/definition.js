require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api, DEFAULT_SCOPES } = require('./api');
const config = require('./defaultConfig.json');

/**
 * Attentive is OAuth 2.0 (authorization-code) for public apps. Private apps use
 * a Bearer API key against the same endpoints; pass that key as access_token.
 *
 * Identity comes from GET /me → companyId / companyName.
 * Access tokens do not expire (no refresh grant per Attentive docs).
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Attentive',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            if (!code) {
                throw new Error(
                    'Attentive OAuth callback missing authorization code'
                );
            }
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const me = await api.getMe();
            if (!me?.companyId) {
                throw new Error(
                    'Attentive /me failed to return companyId. Response: ' +
                        JSON.stringify(me)
                );
            }
            return {
                identifiers: { externalId: String(me.companyId), userId },
                details: {
                    name: me.companyName || me.applicationName || me.companyId,
                    attentiveDomainName: me.attentiveDomainName,
                    contactEmail: me.contactEmail,
                    applicationName: me.applicationName,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const me = await api.getMe();
            if (!me?.companyId) {
                throw new Error(
                    'Attentive /me failed to return companyId. Response: ' +
                        JSON.stringify(me)
                );
            }
            return {
                identifiers: { externalId: String(me.companyId), userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            // id_token is returned alongside access_token on the token exchange.
            // Tokens do not refresh; no refresh_token / expire fields.
            credential: ['access_token', 'id_token'],
            entity: [],
        },

        testAuthRequest: async (api) => api.getMe(),
    },
    env: {
        client_id: process.env.ATTENTIVE_CLIENT_ID,
        client_secret: process.env.ATTENTIVE_CLIENT_SECRET,
        scope: process.env.ATTENTIVE_SCOPE || DEFAULT_SCOPES,
        // Omit when unset so schema validation does not see the string "undefined/attentive".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/attentive`
            : undefined,
        base_url: process.env.ATTENTIVE_BASE_URL,
    },
};

module.exports = { Definition };
