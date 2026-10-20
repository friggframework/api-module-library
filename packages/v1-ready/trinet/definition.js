require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Extract a company id from a TriNet /core/me (or list) payload.
 * Prefer an expanded company object; fall back to parsing the ref URL.
 */
function companyIdFromMe(meResponse) {
    const data = meResponse?.data || meResponse;
    const company = data?.company;
    if (!company) return null;
    if (company.id) return String(company.id);
    if (company.data?.id) return String(company.data.id);
    const url = company.url;
    if (typeof url === 'string') {
        const match = url.match(/\/core\/companies\/([^/?#]+)/);
        if (match) return match[1];
    }
    return null;
}

/**
 * Resolve the connected TriNet company for entity/credential identity.
 * Prefer GET /core/me?includes=company; fall back to the first listCompanies
 * result. Never use a shared constant — two customers must not collide.
 */
async function resolveCompanyIdentity(api) {
    try {
        const me = await api.getMe({ includes: 'company' });
        const companyId = companyIdFromMe(me);
        const company =
            me?.data?.company?.data ||
            (me?.data?.company?.id ? me.data.company : null);
        if (companyId) {
            return {
                externalId: companyId,
                name: company?.name || company?.legal_name || `TriNet ${companyId}`,
            };
        }
    } catch (_e) {
        // fall through
    }

    try {
        const list = await api.listCompanies({ limit: 1 });
        const items = list?.data?.data;
        const first = Array.isArray(items) ? items[0] : null;
        if (first?.id) {
            return {
                externalId: String(first.id),
                name: first.name || first.legal_name || `TriNet ${first.id}`,
            };
        }
    } catch (_e) {
        // fall through
    }

    throw new Error(
        'TriNet: cannot derive a stable company identity — /core/me and /core/companies returned no company id.'
    );
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'TriNet',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) || get(params.data || {}, 'code');
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
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },

        testAuthRequest: async (api) => {
            return api.testAuth();
        },
    },
    env: {
        client_id: process.env.TRINET_CLIENT_ID,
        client_secret: process.env.TRINET_CLIENT_SECRET,
        scope: process.env.TRINET_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/trinet`,
    },
};

module.exports = { Definition };
