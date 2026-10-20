require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Select a tenant connection after OAuth.
 * Prefer an explicit tenantId from the callback / UI; otherwise the first
 * ORGANISATION connection; otherwise the first connection.
 */
function pickConnection(connections, preferredTenantId) {
    const list = Array.isArray(connections) ? connections : [];
    if (preferredTenantId) {
        const match = list.find((c) => c.tenantId === preferredTenantId);
        if (match) return match;
    }
    return (
        list.find((c) => c.tenantType === 'ORGANISATION') || list[0] || null
    );
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Xero',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) ||
                get(params.data || {}, 'code', null);
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const preferredTenantId =
                get(callbackParams || {}, 'tenantId', null) ||
                get(callbackParams || {}, 'tenant_id', null);
            const connections = await api.getConnections();
            const selected = pickConnection(connections, preferredTenantId);
            if (!selected?.tenantId) {
                throw new Error(
                    'Xero: no tenant connections available after OAuth. The user must authorise at least one organisation.'
                );
            }
            api.setTenant(selected.tenantId);

            const org = await api.getOrganisation();
            const externalId =
                org?.OrganisationID ||
                org?.organisationID ||
                selected.tenantId;

            return {
                identifiers: { externalId: String(externalId), userId },
                details: {
                    name: org?.Name || selected.tenantName || 'Xero',
                    tenantId: selected.tenantId,
                    tenantType: selected.tenantType,
                    connectionId: selected.id,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            // Credential is scoped to the OAuth app + user token, not a single
            // tenant. Prefer OrganisationID when a tenant is already set;
            // otherwise fingerprint via the first connection's authEventId /
            // first tenantId so re-auth lands on the same credential row.
            if (api.tenantId) {
                const org = await api.getOrganisation();
                const externalId =
                    org?.OrganisationID || org?.organisationID || api.tenantId;
                return {
                    identifiers: { externalId: String(externalId), userId },
                    details: {},
                };
            }
            const connections = await api.getConnections();
            const first = pickConnection(connections);
            if (!first?.tenantId) {
                throw new Error(
                    'Xero: cannot derive credential identity — no connections and no tenantId.'
                );
            }
            return {
                identifiers: { externalId: String(first.tenantId), userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token', 'accessTokenExpire'],
            entity: ['tenantId'],
        },

        testAuthRequest: async (api) => {
            if (!api.tenantId) {
                const connections = await api.getConnections();
                const selected = pickConnection(connections);
                if (selected?.tenantId) api.setTenant(selected.tenantId);
            }
            return api.getOrganisations();
        },
    },
    env: {
        client_id: process.env.XERO_CLIENT_ID,
        client_secret: process.env.XERO_CLIENT_SECRET,
        scope:
            process.env.XERO_SCOPE ||
            'openid profile email offline_access accounting.transactions accounting.contacts accounting.settings',
        redirect_uri: `${process.env.REDIRECT_URI}/xero`,
    },
};

module.exports = { Definition };
