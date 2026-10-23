require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Rev.io Basic auth uses a username + client_code + password. The client_code
 * identifies the Rev.io instance/tenant and is stable across users on that
 * instance, so it is the natural externalId. When client_code is missing we
 * refuse rather than invent a shared constant.
 */
async function resolveAccountIdentity(api) {
    const clientCode = api?.client_code;
    if (!clientCode) {
        throw new Error(
            'Rev.io: cannot derive a stable account identity — client_code is required.'
        );
    }

    let name = String(clientCode);
    try {
        const result = await api.listBillProfiles({
            'search.page_size': 1,
            'search.page': 1,
        });
        const first = Array.isArray(result?.records) ? result.records[0] : null;
        if (first?.description) {
            name = first.description;
        }
    } catch (_e) {
        // Identity still resolves from client_code alone.
    }

    return { externalId: String(clientCode), name };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Revio',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async function (api, params) {
            const data = (params && params.data) || {};
            const username =
                get(params, 'username', null) || get(data, 'username', null);
            const password =
                get(params, 'password', null) || get(data, 'password', null);
            const clientCode =
                get(params, 'client_code', null) ||
                get(data, 'client_code', null);

            if (username) api.username = username;
            if (password) api.password = password;
            if (clientCode) api.client_code = clientCode;
            return api;
        },

        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name, client_code: identity.externalId },
            };
        },

        getCredentialDetails: async function (api, userId) {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { client_code: identity.externalId },
            };
        },

        apiPropertiesToPersist: {
            credential: ['username', 'password', 'client_code'],
            entity: ['client_code'],
        },

        testAuthRequest: async function (api) {
            return api.testAuth();
        },
    },
    env: {
        username: process.env.REVIO_USERNAME,
        password: process.env.REVIO_PASSWORD,
        client_code: process.env.REVIO_CLIENT_CODE,
        base_url: process.env.REVIO_BASE_URL,
    },
};

module.exports = { Definition };
