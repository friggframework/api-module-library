require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api, DEFAULT_SCOPE } = require('./api');
const config = require('./defaultConfig.json');

async function resolveIdentity(api) {
    // Prefer /me (mailbox owner) for Outlook; fall back to organization when
    // /me is unavailable (e.g. some app-only flows).
    try {
        const me = await api.getMe();
        if (me?.id) {
            return {
                externalId: me.id,
                name: me.displayName || me.userPrincipalName || me.mail || me.id,
                tenant_id: api.tenant_id,
                mail: me.mail || me.userPrincipalName || null,
            };
        }
    } catch (_e) {
        // fall through to organization
    }

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
                mail: null,
            };
        }
    } catch (_e) {
        // fall through
    }

    throw new Error(
        'Microsoft Outlook: cannot derive a stable account identity from /me or /organization'
    );
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'MicrosoftOutlook',
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
                        'Microsoft Outlook OAuth callback missing authorization code'
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
                    mail: identity.mail,
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
        client_id: process.env.OUTLOOK_CLIENT_ID,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET,
        scope: process.env.OUTLOOK_SCOPE || DEFAULT_SCOPE,
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/microsoft-outlook`
            : 'https://localhost/redirect/microsoft-outlook',
    },
};

module.exports = { Definition };
