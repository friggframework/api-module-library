require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Calendly is OAuth 2.0 authenticated. Identity comes from GET /users/me
 * (`resource.uri` as the stable externalId).
 */
const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Calendly',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code =
                get(params, 'code', null) || get(params.data || {}, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            const identity = await api.getTokenIdentity();
            return {
                identifiers: {
                    externalId: identity.identifier,
                    userId,
                },
                details: {
                    name: identity.name,
                    email: identity.email,
                    organization: identity.organization,
                },
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            // Account fields from calendly.capabilities.json (`organization`, `user` URIs)
            entity: ['organization', 'user'],
        },
        getCredentialDetails: async function (api, userId) {
            const identity = await api.getTokenIdentity();
            return {
                identifiers: {
                    externalId: identity.identifier,
                    userId,
                },
                details: {},
            };
        },
        testAuthRequest: async function (api) {
            return api.getCurrentUser();
        },
        getAuthorizationRequirements: async function (api) {
            return api.getAuthorizationRequirements();
        },
    },
    env: {
        client_id: process.env.CALENDLY_CLIENT_ID,
        client_secret: process.env.CALENDLY_CLIENT_SECRET,
        scope: process.env.CALENDLY_SCOPE,
        // Omit when unset so schema validation does not see the string "undefined/calendly".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/calendly`
            : undefined,
    },
};

module.exports = { Definition };
