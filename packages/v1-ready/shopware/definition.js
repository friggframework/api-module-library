require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Shop-Ware is partner API-key authenticated (X-Api-Partner-Id + X-Api-Secret).
 * There is no OAuth flow. Identity is the first authorized tenant from
 * GET /tenants (id + name). When the tenant list is empty or the call fails
 * and a SHOPWARE_TENANT_ID / api.tenant_id is set, that id is used instead.
 */
async function resolveAccountIdentity(api) {
    try {
        const page = await api.listTenants({ per_page: 1 });
        const first = Array.isArray(page?.results) ? page.results[0] : null;
        if (first?.id != null) {
            return {
                externalId: String(first.id),
                name: first.name || first.cname || `tenant-${first.id}`,
                tenantId: first.id,
            };
        }
    } catch (e) {
        // fall through
    }

    if (api.tenant_id != null && api.tenant_id !== '') {
        return {
            externalId: String(api.tenant_id),
            name: `tenant-${api.tenant_id}`,
            tenantId: api.tenant_id,
        };
    }

    throw new Error(
        'Shop-Ware: cannot derive a stable account identity — no authorized tenants returned and no tenant_id configured.'
    );
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'ShopWare',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Shop-Ware Authentication',
                    type: 'object',
                    required: ['api_partner_id', 'api_secret'],
                    properties: {
                        api_partner_id: {
                            type: 'string',
                            title: 'API Partner Id',
                        },
                        api_secret: {
                            type: 'string',
                            title: 'API Secret',
                        },
                        tenant_id: {
                            type: 'string',
                            title: 'Default Tenant Id (optional)',
                        },
                    },
                },
                uiSchema: {
                    api_partner_id: {
                        'ui:help':
                            'Partner id issued by Shop-Ware support. Sent as the X-Api-Partner-Id header.',
                    },
                    api_secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'API secret issued by Shop-Ware support. Sent as the X-Api-Secret header. Also used to verify inbound webhooks.',
                    },
                    tenant_id: {
                        'ui:help':
                            'Optional default tenant for tenant-scoped calls. Leave blank to use the first authorized tenant from GET /tenants.',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const partnerId =
                get(params, 'api_partner_id', null) ||
                get(data, 'api_partner_id', null);
            const secret =
                get(params, 'api_secret', null) ||
                get(data, 'api_secret', null) ||
                get(params, 'api_key', null) ||
                get(data, 'api_key', null);
            const tenantId =
                get(params, 'tenant_id', null) ||
                get(data, 'tenant_id', null);

            if (partnerId) api.setApiPartnerId(partnerId);
            if (secret) api.setApiSecret(secret);
            if (tenantId != null && tenantId !== '') {
                api.setTenantId(tenantId);
            }
            return api;
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            if (identity.tenantId != null) {
                api.setTenantId(identity.tenantId);
            }
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    tenantId: identity.tenantId,
                },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                },
            };
        },
        apiPropertiesToPersist: {
            credential: ['api_partner_id', 'api_secret'],
            entity: ['tenant_id'],
        },
        testAuthRequest: async (api) => {
            return api.listTenants({ per_page: 1 });
        },
    },
    env: {
        api_partner_id: process.env.SHOPWARE_API_PARTNER_ID,
        api_secret: process.env.SHOPWARE_API_SECRET,
        tenant_id: process.env.SHOPWARE_TENANT_ID,
    },
};

module.exports = { Definition };
