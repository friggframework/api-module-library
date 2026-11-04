require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Paychex Flex — OAuth 2.0 client credentials (application API key + secret).
 * There is no browser redirect. Access tokens (~600s) are re-minted with
 * client credentials; there is no refresh_token.
 *
 * Identity: prefer an explicit company_id when provided; otherwise use the
 * first company from GET /companies; fall back to the client_id (stable
 * per application). Partner approval is required for production keys —
 * see https://developer.paychex.com/partner
 */
async function resolveAccountIdentity(api) {
    if (api.company_id) {
        let name = api.company_id;
        try {
            const res = await api.getCompany(api.company_id);
            const company = Array.isArray(res?.content)
                ? res.content[0]
                : res?.content || res;
            name =
                company?.legalName ||
                company?.displayId ||
                company?.companyId ||
                name;
        } catch (e) {
            // companies:read may not be granted yet
        }
        return { externalId: String(api.company_id), name };
    }

    try {
        const res = await api.listCompanies({});
        const companies = Array.isArray(res?.content) ? res.content : [];
        if (companies.length === 1) {
            const company = companies[0];
            const id = company.companyId;
            if (id) {
                api.company_id = id;
                return {
                    externalId: String(id),
                    name:
                        company.legalName ||
                        company.displayId ||
                        String(id),
                };
            }
        }
        if (companies.length > 1) {
            // Multi-company app key — bind to the application client_id.
            return {
                externalId: String(api.client_id),
                name: `Paychex (${companies.length} companies)`,
            };
        }
    } catch (e) {
        // fall through
    }

    if (!api.client_id) {
        throw new Error(
            'Paychex: cannot derive a stable account identity — no company and no client_id.'
        );
    }
    return { externalId: String(api.client_id), name: 'Paychex' };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Paychex',
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
            const companyId =
                get(params, 'company_id', null) ||
                get(data, 'company_id', null);

            if (clientId) api.client_id = clientId;
            if (clientSecret) api.client_secret = clientSecret;
            if (companyId) api.company_id = companyId;
            return api;
        },

        getToken: async (api, params) => {
            if (params) {
                await Definition.requiredAuthMethods.setAuthParams(api, params);
            }
            return api.getTokenFromClientCredentials();
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    company_id: api.company_id || null,
                },
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
                'access_token',
                'accessTokenExpire',
                'client_id',
                'client_secret',
            ],
            entity: ['company_id'],
        },

        testAuthRequest: async (api) => {
            return api.listCompanies({});
        },
    },
    env: {
        client_id: process.env.PAYCHEX_CLIENT_ID,
        client_secret: process.env.PAYCHEX_CLIENT_SECRET,
        base_url: process.env.PAYCHEX_BASE_URL,
    },
    encryption: {
        credentialFields: ['client_secret'],
    },
};

module.exports = { Definition };
