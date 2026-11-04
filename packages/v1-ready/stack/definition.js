require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Stack Global is static-Bearer authenticated (no OAuth). There is no published
 * "/me" identity endpoint, so identity is derived from:
 *   1. companyId on the Api instance / auth form (when provided)
 *   2. sha256 fingerprint of the bearer secret (stable, non-reversible)
 *
 * There is deliberately NO shared constant fallback: two different customers
 * must never map to the same entity/credential.
 */
const keyFingerprint = (token) =>
    crypto.createHash('sha256').update(String(token)).digest('hex');

async function resolveAccountIdentity(api) {
    if (api?.companyId !== undefined && api?.companyId !== null && api?.companyId !== '') {
        return {
            externalId: String(api.companyId),
            name: `Stack company ${api.companyId}`,
        };
    }

    try {
        const company = await api.getCompany();
        const id =
            company?.companyId ||
            company?.id ||
            company?.data?.companyId ||
            company?.data?.id ||
            company?.body?.data?.companyId ||
            null;
        const name =
            company?.name ||
            company?.data?.name ||
            company?.body?.data?.name ||
            null;
        if (id) {
            return {
                externalId: String(id),
                name: name ? String(name) : `Stack company ${id}`,
            };
        }
    } catch (e) {
        // fall through to fingerprint
    }

    const token = api?.bearer_token || api?.api_key;
    if (!token) {
        throw new Error(
            'Stack: cannot derive a stable account identity — no companyId and no bearer token to fingerprint.'
        );
    }
    return { externalId: keyFingerprint(token), name: 'Stack' };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Stack',
    mappings: {
        business: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Stack Authentication',
                    type: 'object',
                    required: ['bearer_token', 'base_url'],
                    properties: {
                        bearer_token: {
                            type: 'string',
                            title: 'Stack Secret',
                        },
                        base_url: {
                            type: 'string',
                            title: 'API Base URL',
                            description:
                                'Stack partner API host (STACK_BASE_URL). No public default is documented by the vendor.',
                        },
                        companyId: {
                            type: 'string',
                            title: 'Company ID',
                            description:
                                'Stack company id passed to /integration/* query params.',
                        },
                        integrationType: {
                            type: 'string',
                            title: 'Integration Type',
                            description:
                                'Integration type string passed as `type` on authorize and read calls.',
                        },
                    },
                },
                uiSchema: {
                    bearer_token: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Static Stack partner secret. Sent as Authorization: Bearer <secret>.',
                    },
                    base_url: {
                        'ui:help':
                            'Required. Set to the Stack API host provided for your partner integration (STACK_BASE_URL).',
                    },
                    companyId: {
                        'ui:help':
                            'Numeric or string company id used on salesCycle / company / members calls.',
                    },
                    integrationType: {
                        'ui:help':
                            'Optional. Partner integration type discriminator (e.g. browser_extension).',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const bearer =
                get(params, 'bearer_token', null) ||
                get(params, 'api_key', null) ||
                get(params, 'access_token', null) ||
                get(params, 'secret', null) ||
                get(data, 'bearer_token', null) ||
                get(data, 'api_key', null) ||
                get(data, 'secret', null);
            const baseUrl =
                get(params, 'base_url', null) ||
                get(params, 'baseUrl', null) ||
                get(data, 'base_url', null) ||
                get(data, 'baseUrl', null);
            const companyId =
                get(params, 'companyId', null) || get(data, 'companyId', null);
            const integrationType =
                get(params, 'integrationType', null) ||
                get(data, 'integrationType', null);

            if (bearer) {
                api.setBearerToken(bearer);
            }
            if (baseUrl) {
                api.baseUrl = baseUrl;
            }
            if (companyId !== null && companyId !== undefined && companyId !== '') {
                api.companyId = companyId;
            }
            if (integrationType) {
                api.integrationType = integrationType;
            }
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    companyId: api.companyId,
                    integrationType: api.integrationType,
                },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    bearer_token: api.bearer_token,
                    baseUrl: api.baseUrl,
                },
            };
        },
        apiPropertiesToPersist: {
            credential: ['bearer_token', 'baseUrl'],
            entity: ['companyId', 'integrationType'],
        },
        testAuthRequest: async (api) => {
            // Prefer a read that proves the secret + company context work.
            try {
                return await api.getCompany();
            } catch (e) {
                return api.authorize();
            }
        },
    },
    env: {
        api_key: process.env.STACK_SECRET,
        bearer_token: process.env.STACK_SECRET,
        base_url: process.env.STACK_BASE_URL,
    },
};

module.exports = { Definition };
