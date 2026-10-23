require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * NetX is OAuth2 (authorization code) against a per-tenant instance URL.
 * Identity comes from JSON-RPC `getSelf` (userId / email / name).
 *
 * The instance root (`baseUrl`) is collected in the auth form (same pattern as
 * Frontify's domain) and persisted on the credential so later requests hit the
 * correct tenant.
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'NetX',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const data = (params && params.data) || {};
            const code = get(params, 'code', null) || get(data, 'code', null);
            const baseUrl =
                get(params, 'baseUrl', null) ||
                get(params, 'base_url', null) ||
                get(data, 'baseUrl', null) ||
                get(data, 'base_url', null);
            if (baseUrl) {
                api.setBaseUrl(baseUrl);
            }
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const response = await api.getSelf();
            const self = response?.result || response;
            if (!self || self.userId == null) {
                throw new Error(
                    'NetX getSelf failed to return a userId. Response: ' +
                        JSON.stringify(response)
                );
            }
            const name =
                [self.firstName, self.lastName].filter(Boolean).join(' ') ||
                self.username ||
                self.email ||
                String(self.userId);
            return {
                identifiers: { externalId: String(self.userId), userId },
                details: { name, email: self.email, username: self.username },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const response = await api.getSelf();
            const self = response?.result || response;
            if (!self || self.userId == null) {
                throw new Error(
                    'NetX getSelf failed to return a userId. Response: ' +
                        JSON.stringify(response)
                );
            }
            return {
                identifiers: { externalId: String(self.userId), userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'baseUrl',
                'accessTokenExpire',
            ],
            entity: [],
        },

        testAuthRequest: async (api) => api.getSelf(),
    },
    env: {
        client_id: process.env.NETX_CLIENT_ID,
        client_secret: process.env.NETX_CLIENT_SECRET,
        scope: process.env.NETX_SCOPE || 'api',
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/netx`
            : undefined,
        base_url: process.env.NETX_BASE_URL,
    },
};

module.exports = { Definition };
