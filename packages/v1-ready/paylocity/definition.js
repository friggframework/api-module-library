require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Paylocity uses OAuth 2.0 client credentials (no browser redirect). There is
 * no public "/me" identity endpoint on the Weblink API; every resource is
 * scoped by `companyId`. The Frigg entity/credential externalId is therefore
 * the Paylocity company id supplied at auth time.
 *
 * Access to sandbox/production credentials requires Paylocity partner or
 * customer approval (see Getting Started / Integration Requirements).
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Paylocity',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const clientId =
                get(params, 'client_id', null) ||
                get(params, 'clientId', null) ||
                get(data, 'client_id', null) ||
                get(data, 'clientId', null);
            const clientSecret =
                get(params, 'client_secret', null) ||
                get(params, 'clientSecret', null) ||
                get(data, 'client_secret', null) ||
                get(data, 'clientSecret', null);
            const companyId =
                get(params, 'company_id', null) ||
                get(params, 'companyId', null) ||
                get(data, 'company_id', null) ||
                get(data, 'companyId', null);
            const environment =
                get(params, 'environment', null) ||
                get(data, 'environment', null);
            const baseUrl =
                get(params, 'base_url', null) || get(data, 'base_url', null);
            const tokenUri =
                get(params, 'token_uri', null) || get(data, 'token_uri', null);

            if (clientId) api.client_id = clientId;
            if (clientSecret) api.client_secret = clientSecret;
            if (companyId) api.setCompanyId(companyId);
            if (environment) api.setEnvironment(environment);
            if (baseUrl) api.baseUrl = baseUrl;
            if (tokenUri) api.tokenUri = tokenUri;
            return api;
        },

        getToken: async (api, params) => {
            if (params) {
                await Definition.requiredAuthMethods.setAuthParams(api, params);
            }
            return api.getTokenFromClientCredentials();
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const companyId = api.company_id;
            if (!companyId) {
                throw new Error(
                    'Paylocity: company_id is required to derive a stable account identity for entity routing.'
                );
            }
            return {
                identifiers: { externalId: String(companyId), userId },
                details: {
                    name: `Paylocity ${companyId}`,
                    company_id: String(companyId),
                    environment: api.environment,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const companyId = api.company_id;
            if (!companyId) {
                throw new Error(
                    'Paylocity: company_id is required to derive a stable credential identity.'
                );
            }
            return {
                identifiers: { externalId: String(companyId), userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'accessTokenExpire',
                'client_id',
                'client_secret',
                'company_id',
                'scope',
                'environment',
            ],
            entity: ['company_id', 'environment'],
        },

        testAuthRequest: async (api) => {
            // Lightweight authenticated list (first page of employees).
            return api.listEmployees({});
        },
    },
    env: {
        client_id: process.env.PAYLOCITY_CLIENT_ID,
        client_secret: process.env.PAYLOCITY_CLIENT_SECRET,
        company_id: process.env.PAYLOCITY_COMPANY_ID,
        base_url: process.env.PAYLOCITY_BASE_URL,
    },
    encryption: {
        // client_secret is custom beyond the core OAuth token fields.
        credentialFields: ['client_secret'],
    },
};

module.exports = { Definition };
