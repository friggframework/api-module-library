require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Rippling App Shop / Platform API module.
 *
 * Auth is OAuth 2.0 authorization code (Basic client credentials on the token
 * endpoint). Identity is the Rippling company id from GET /companies/ after
 * token exchange — one access token maps to one company.
 *
 * App Shop listing requires Rippling partner approval. Customer/internal
 * automation can use Bearer API tokens against the same REST surface; this
 * Definition wires the App Shop OAuth path expected for marketplace connected
 * apps.
 */
async function resolveCompanyIdentity(api) {
    const page = await api.listCompanies({ limit: 1 });
    // Docs show both `{ results: [...] }` and a bare company object in examples.
    const company = Array.isArray(page?.results)
        ? page.results[0]
        : page?.id
          ? page
          : null;

    if (!company?.id) {
        throw new Error(
            'Rippling: GET /companies/ did not return a company id for this token. ' +
                'Confirm companies.read scope and that the token is company-scoped. ' +
                'Response: ' +
                JSON.stringify(page)
        );
    }

    return {
        externalId: String(company.id),
        name: company.name || company.legal_name || String(company.id),
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Rippling',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const clientId =
                get(params, 'client_id', null) || get(data, 'client_id', null);
            const clientSecret =
                get(params, 'client_secret', null) ||
                get(data, 'client_secret', null);
            const appName =
                get(params, 'app_name', null) || get(data, 'app_name', null);
            const accessToken =
                get(params, 'access_token', null) ||
                get(data, 'access_token', null);
            const refreshToken =
                get(params, 'refresh_token', null) ||
                get(data, 'refresh_token', null);

            if (clientId) api.client_id = clientId;
            if (clientSecret) api.client_secret = clientSecret;
            if (appName) api.setAppName(appName);
            if (accessToken) api.access_token = accessToken;
            if (refreshToken) api.refresh_token = refreshToken;
            return api;
        },

        getToken: async (api, params) => {
            if (params) {
                await Definition.requiredAuthMethods.setAuthParams(api, params);
            }
            const data = (params && params.data) || {};
            const code =
                get(params, 'code', null) || get(data, 'code', null);
            if (!code) {
                throw new Error(
                    'Rippling: authorization code is required to exchange for tokens.'
                );
            }
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveCompanyIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = await resolveCompanyIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'client_id',
                'client_secret',
            ],
            entity: ['app_name'],
        },

        testAuthRequest: async (api) => {
            return api.listCompanies({ limit: 1 });
        },
    },
    env: {
        client_id: process.env.RIPPLING_CLIENT_ID,
        client_secret: process.env.RIPPLING_CLIENT_SECRET,
        app_name: process.env.RIPPLING_APP_NAME,
        scope: process.env.RIPPLING_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/rippling`,
    },
};

module.exports = { Definition };
