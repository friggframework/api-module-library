require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * UKG Pro HCM Core REST uses Basic Auth + US-Customer-Api-Key. There is no
 * browser OAuth redirect on this surface. Tenant identity is the Customer API
 * Key (unique per Pro HR tenant); company display name is enriched from
 * GET /configuration/v1/company-details when available.
 */
async function resolveAccountIdentity(api) {
    const customerKey = api?.customer_api_key;
    if (!customerKey) {
        throw new Error(
            'UKG Pro: customer_api_key is required to derive a stable account identity.'
        );
    }

    let name = `UKG Pro ${customerKey}`;
    try {
        const companies = await api.listCompanyDetails({
            page: 1,
            per_Page: 25,
        });
        const list = Array.isArray(companies)
            ? companies
            : Array.isArray(companies?.data)
              ? companies.data
              : [];
        const master =
            list.find(
                (c) =>
                    c?.isMasterCompany === true ||
                    c?.isMasterCompany === 'true'
            ) || list[0];
        if (master?.companyName) {
            name = master.companyName;
        } else if (master?.companyID || master?.companyId) {
            name = `UKG Pro ${master.companyID || master.companyId}`;
        }
    } catch (_e) {
        // fall through — customer_api_key alone is a stable tenant id
    }

    return { externalId: String(customerKey), name };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'UkgPro',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const username =
                get(params, 'username', null) ||
                get(params, 'user_name', null) ||
                get(data, 'username', null) ||
                get(data, 'user_name', null);
            const password =
                get(params, 'password', null) || get(data, 'password', null);
            const customerApiKey =
                get(params, 'customer_api_key', null) ||
                get(params, 'customerApiKey', null) ||
                get(params, 'api_key', null) ||
                get(data, 'customer_api_key', null) ||
                get(data, 'customerApiKey', null) ||
                get(data, 'api_key', null);
            const baseUrl =
                get(params, 'base_url', null) ||
                get(params, 'baseUrl', null) ||
                get(params, 'hostname', null) ||
                get(data, 'base_url', null) ||
                get(data, 'baseUrl', null) ||
                get(data, 'hostname', null);

            if (username) api.setUsername(username);
            if (password) api.setPassword(password);
            if (customerApiKey) api.setCustomerApiKey(customerApiKey);
            if (baseUrl) api.setBaseUrl(baseUrl);
            return api;
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
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
            credential: [
                'username',
                'password',
                'customer_api_key',
                'base_url',
            ],
            entity: ['base_url'],
        },

        testAuthRequest: async (api) => {
            return api.testAuth();
        },
    },
    env: {
        username: process.env.UKG_PRO_USERNAME,
        password: process.env.UKG_PRO_PASSWORD,
        customer_api_key: process.env.UKG_PRO_CUSTOMER_API_KEY,
        base_url: process.env.UKG_PRO_BASE_URL,
    },
    encryption: {
        credentialFields: ['password', 'customer_api_key'],
    },
};

module.exports = { Definition };
