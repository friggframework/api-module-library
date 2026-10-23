require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Factorial HR — OAuth2 company-token connection.
 *
 * Marketplace integrations must use OAuth 2.0 (API keys are being phased out
 * for marketplace). Authorize with resource_owner_type=company for a Company
 * Token. Identity is derived from GET /resources/api_public/credentials
 * (company_id + name/legal_name).
 *
 * Docs: https://apidoc.factorialhr.com/docs/authentication
 *       https://apidoc.factorialhr.com/docs/request-an-authorization-code
 */
async function resolveCompanyIdentity(api) {
    const result = await api.listCredentials();
    const items = Array.isArray(result?.data)
        ? result.data
        : Array.isArray(result)
          ? result
          : [];
    const first = items[0];
    if (!first || first.company_id == null) {
        throw new Error(
            'Factorial: cannot derive a stable account identity — ' +
                'credentials response missing company_id.'
        );
    }
    api.company_id = first.company_id;
    return {
        externalId: String(first.company_id),
        name:
            first.name ||
            first.legal_name ||
            `Factorial ${first.company_id}`,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Factorial',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) || get(params?.data || {}, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveCompanyIdentity(api);
            return {
                identifiers: {
                    externalId: identity.externalId,
                    userId,
                },
                details: { name: identity.name },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveCompanyIdentity(api);
            return {
                identifiers: {
                    externalId: identity.externalId,
                    userId,
                },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token', 'api_key'],
            entity: ['company_id'],
        },
        testAuthRequest: async (api) => api.listCredentials(),
    },
    env: {
        client_id: process.env.FACTORIAL_CLIENT_ID,
        client_secret: process.env.FACTORIAL_CLIENT_SECRET,
        scope: process.env.FACTORIAL_SCOPE,
        // Omit when unset so schema validation does not see the string "undefined/factorial".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/factorial`
            : undefined,
        base_url: process.env.FACTORIAL_BASE_URL,
        auth_base_url: process.env.FACTORIAL_AUTH_BASE_URL,
    },
};

module.exports = { Definition };
