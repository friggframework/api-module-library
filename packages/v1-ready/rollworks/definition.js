require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Unwrap organization payloads. Current CRUD docs show
 * `{ eid, name, created_date }` at the top level; the prior v1 module and some
 * live responses wrap the same fields under `results`.
 */
function unwrapOrganization(response) {
    if (!response || typeof response !== 'object') return null;
    if (response.results && typeof response.results === 'object' && !Array.isArray(response.results)) {
        return response.results;
    }
    return response;
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'RollWorks',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) => ({
            url: api.getAuthUri(),
            type: 'oauth2',
        }),

        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) ||
                get(params.data || {}, 'code', null);
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const orgResponse = await api.getOrganization();
            const org = unwrapOrganization(orgResponse);
            if (!org?.eid) {
                throw new Error(
                    'RollWorks: getOrganization did not return an organization eid'
                );
            }
            return {
                identifiers: { externalId: org.eid, userId },
                details: { name: org.name || org.eid },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const orgResponse = await api.getOrganization();
            const org = unwrapOrganization(orgResponse);
            if (!org?.eid) {
                throw new Error(
                    'RollWorks: getOrganization did not return an organization eid'
                );
            }
            return {
                identifiers: { externalId: org.eid, userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: ['advertisable_eid'],
        },

        testAuthRequest: async (api) => api.getOrganization(),
    },
    env: {
        client_id: process.env.ROLLWORKS_CLIENT_ID,
        client_secret: process.env.ROLLWORKS_CLIENT_SECRET,
        scope: process.env.ROLLWORKS_SCOPE || process.env.ROLLWORKS_SCOPES || 'all',
        // Omit when unset so schema validation does not see the string "undefined/rollworks".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/rollworks`
            : undefined,
    },
};

module.exports = { Definition };
