require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Freshdesk is API-key authenticated (HTTP Basic with api_key:X). There is no
 * OAuth flow on the public REST API. Account identity comes from GET /account
 * (account_id / account_domain / account_name).
 */
async function resolveAccountIdentity(api) {
    const account = await api.getAccount();
    if (!account || account.account_id == null) {
        throw new Error(
            'Freshdesk: GET /account did not return account_id. ' +
                'Response: ' +
                JSON.stringify(account)
        );
    }
    return {
        externalId: String(account.account_id),
        name:
            account.account_name ||
            account.account_domain ||
            `Freshdesk ${account.account_id}`,
        domain: account.account_domain || api.domain,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Freshdesk',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const domain =
                get(params, 'domain', null) || get(data, 'domain', null);
            const apiKey =
                get(params, 'api_key', null) ||
                get(data, 'api_key', null) ||
                get(params, 'access_token', null) ||
                get(data, 'access_token', null);

            if (domain) api.setDomain(domain);
            if (apiKey) api.setApiKey(apiKey);
            return api;
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name, domain: identity.domain },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: ['api_key', 'domain'],
            entity: [],
        },

        testAuthRequest: async (api) => {
            return api.testAuth();
        },
    },
    env: {
        api_key: process.env.FRESHDESK_API_KEY,
        domain: process.env.FRESHDESK_DOMAIN,
        base_url: process.env.FRESHDESK_BASE_URL,
    },
};

module.exports = { Definition };
