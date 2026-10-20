require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve a stable Airtable account identity for entity/credential keys.
 * Prefer GET /meta/whoami (`id`, optional `email`).
 */
async function resolveAccountIdentity(api) {
    const me = await api.getWhoami();
    const externalId = me?.id;
    if (!externalId) {
        throw new Error(
            'Airtable: cannot derive a stable account identity — GET /meta/whoami returned no id.'
        );
    }
    return {
        externalId: String(externalId),
        name: me.email || String(externalId),
        email: me.email || null,
        scopes: Array.isArray(me.scopes) ? me.scopes : undefined,
    };
}

/**
 * Snapshot accessible base ids at auth time so webhook notification pings
 * (which only carry `base.id`) can reverse-lookup the owning integration.
 */
async function listGrantedBaseIds(api) {
    try {
        const page = await api.listBases({});
        const bases = Array.isArray(page?.bases) ? page.bases : [];
        return bases.map((b) => b.id).filter(Boolean);
    } catch (e) {
        // schema.bases:read may be absent; webhook lookup then needs another path.
        return [];
    }
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Airtable',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) || get(params, 'data.code', null);
            const state =
                get(params, 'state', null) || get(params, 'data.state', null);
            if (state) {
                api.restoreVerifierFromState(state);
            }
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            const baseIds = await listGrantedBaseIds(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    email: identity.email,
                    baseIds,
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
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },

        testAuthRequest: async (api) => api.getWhoami(),
    },
    env: {
        client_id: process.env.AIRTABLE_CLIENT_ID,
        client_secret: process.env.AIRTABLE_CLIENT_SECRET,
        scope: process.env.AIRTABLE_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/airtable`,
    },
};

module.exports = { Definition };
