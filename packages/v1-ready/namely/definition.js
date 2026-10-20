require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Namely is multi-tenant on `{company}.namely.com`. Auth is a Bearer Personal
 * Access Token (or OAuth access token) plus the company subdomain. Identity for
 * the Frigg entity/credential is the company subdomain (permalink) — the same
 * value used to build the API host — with the authenticated profile from
 * GET /profiles/me available for display name when reachable.
 */
async function resolveAccountIdentity(api) {
    const company = api?.company;
    if (!company) {
        throw new Error(
            'Namely: company subdomain is required to derive a stable account identity.'
        );
    }

    let name = `Namely ${company}`;
    try {
        const me = await api.getCurrentProfile();
        const profile = Array.isArray(me?.profiles) ? me.profiles[0] : null;
        if (profile?.full_name || profile?.email) {
            name = profile.full_name || profile.email;
        }
    } catch (e) {
        // Fall through — company subdomain alone is a stable tenant id.
    }

    return { externalId: String(company), name };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Namely',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const company =
                get(params, 'company', null) ||
                get(params, 'company_subdomain', null) ||
                get(params, 'permalink', null) ||
                get(data, 'company', null) ||
                get(data, 'company_subdomain', null) ||
                get(data, 'permalink', null);
            const token =
                get(params, 'access_token', null) ||
                get(params, 'api_token', null) ||
                get(params, 'api_key', null) ||
                get(data, 'access_token', null) ||
                get(data, 'api_token', null) ||
                get(data, 'api_key', null);

            if (company) api.setCompany(company);
            if (token) api.setAccessToken(token);
            return api;
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name, company: api.company },
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
            credential: ['access_token', 'company'],
            entity: ['company'],
        },

        testAuthRequest: async (api) => {
            return api.testAuth();
        },
    },
    env: {
        access_token: process.env.NAMELY_ACCESS_TOKEN,
        company: process.env.NAMELY_COMPANY,
    },
    encryption: {
        credentialFields: ['access_token'],
    },
};

module.exports = { Definition };
