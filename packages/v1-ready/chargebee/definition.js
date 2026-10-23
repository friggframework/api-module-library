require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Chargebee is HTTP Basic authenticated (API key as username, empty password)
 * scoped to a site subdomain. There is no OAuth flow and no dedicated "/me"
 * identity endpoint on the public REST API, so the connected entity is the
 * Chargebee site itself — `site` from the auth form is the stable externalId.
 *
 * Docs: https://apidocs.chargebee.com/docs/api/auth?prod_cat_ver=2
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Chargebee',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const apiKey =
                get(params, 'api_key', null) ||
                get(data, 'api_key', null) ||
                get(params, 'access_token', null);
            const site = get(params, 'site', null) || get(data, 'site', null);

            if (site) {
                api.setSite(site);
            }
            if (apiKey) {
                api.setApiKey(apiKey);
                api.password = '';
            }
            return api;
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const site = api.site;
            if (!site) {
                throw new Error(
                    'Chargebee: cannot derive account identity — site subdomain is required.'
                );
            }
            return {
                identifiers: { externalId: String(site), userId },
                details: { name: String(site), site: String(site) },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const site = api.site;
            if (!site) {
                throw new Error(
                    'Chargebee: cannot derive credential identity — site subdomain is required.'
                );
            }
            return {
                identifiers: { externalId: String(site), userId },
                details: { site: String(site) },
            };
        },

        apiPropertiesToPersist: {
            credential: ['api_key', 'site'],
            entity: ['site'],
        },

        testAuthRequest: async (api) => {
            return api.testAuth();
        },
    },
    env: {
        api_key: process.env.CHARGEBEE_API_KEY,
        site: process.env.CHARGEBEE_SITE,
    },
};

module.exports = { Definition };
