require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api, DEFAULT_SCOPE } = require('./api');
const config = require('./defaultConfig.json');

async function resolveIdentity(api) {
    // Prefer organization id (tenant) — matches the v1 module and org-scoped
    // Teams installs. Fall back to /me when Organization.Read.All is absent.
    try {
        const org = await api.getOrganization();
        if (org?.id) {
            if (api.tenant_id === 'common' || !api.tenant_id) {
                api.setTenantId(org.id);
            }
            return {
                externalId: org.id,
                name: org.displayName || org.id,
                tenant_id: org.id,
            };
        }
    } catch (_e) {
        // fall through to /me
    }

    const me = await api.getMe();
    if (!me?.id) {
        throw new Error(
            'Microsoft Teams: cannot derive a stable account identity from /organization or /me'
        );
    }
    return {
        externalId: me.id,
        name: me.displayName || me.userPrincipalName || me.id,
        tenant_id: api.tenant_id,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'MicrosoftTeams',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            if (params) {
                const data = get(params, 'data', params) || {};
                const code =
                    get(data, 'code', null) || get(params, 'code', null);
                if (!code) {
                    throw new Error(
                        'Microsoft Teams OAuth callback missing authorization code'
                    );
                }
                const tenant =
                    get(data, 'tenant', null) ||
                    get(data, 'tenantId', null) ||
                    get(params, 'tenant', null);
                if (tenant) {
                    api.setTenantId(String(tenant));
                }
                return api.getTokenFromCode(code);
            }
            // No callback params → application (client credentials) flow.
            return api.getTokenFromClientCredentials();
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    tenant_id: identity.tenant_id,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = await resolveIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { tenant_id: identity.tenant_id },
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'tenant_id',
            ],
            entity: ['tenant_id'],
        },

        testAuthRequest: async (api) => api.getMe(),
    },
    env: {
        client_id: process.env.TEAMS_CLIENT_ID,
        client_secret: process.env.TEAMS_CLIENT_SECRET,
        scope: process.env.TEAMS_SCOPE || DEFAULT_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/microsoft-teams`,
    },
};

module.exports = { Definition };
