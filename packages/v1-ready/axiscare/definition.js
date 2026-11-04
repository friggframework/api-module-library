require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * AxisCare is API-key (Bearer) authenticated with a per-site base URL. There is
 * no dedicated identity endpoint on the public REST API, so entity/credential
 * identity is the site number when present, otherwise a sha256 fingerprint of
 * the raw API key (stable, non-reversible, never a shared constant).
 */
const keyFingerprint = (apiKey) =>
    crypto.createHash('sha256').update(String(apiKey)).digest('hex');

function resolveAccountIdentity(api) {
    if (api?.siteNumber) {
        return {
            externalId: String(api.siteNumber),
            name: `AxisCare ${api.siteNumber}`,
        };
    }
    const raw = api?.api_key_raw || api?.api_key;
    if (!raw) {
        throw new Error(
            'AxisCare: cannot derive a stable account identity — no siteNumber and no API key to fingerprint.'
        );
    }
    const token = String(raw).replace(/^Bearer\s+/i, '');
    return { externalId: keyFingerprint(token), name: 'AxisCare' };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'AxisCare',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'AxisCare API Authorization',
                    type: 'object',
                    required: ['api_key', 'siteNumber'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                        siteNumber: {
                            type: 'string',
                            title: 'Site Number',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Create a token in AxisCare under Admin → API token. Sent as Authorization: Bearer <key>.',
                        'ui:placeholder': 'Enter your API key...',
                    },
                    siteNumber: {
                        'ui:help':
                            'Site number from your tenant URL: https://{siteNumber}.axiscare.com',
                        'ui:placeholder': 'Enter your site number...',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'apiKey', null) ||
                get(params, 'access_token', null);
            const siteNumber =
                get(params, 'siteNumber', null) ||
                get(params, 'site_number', null);

            if (!apiKey) {
                throw new Error(
                    'API key is required for AxisCare authentication'
                );
            }
            if (!siteNumber) {
                throw new Error(
                    'Site number is required for AxisCare authentication'
                );
            }

            api.setApiKey(apiKey);
            api.setSiteNumber(siteNumber);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['api_key', 'siteNumber'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            try {
                return await api.listClients({ limit: 1 });
            } catch (error) {
                return api.listLeads({ limit: 1 });
            }
        },
    },
    encryption: {
        credentialFields: ['api_key'],
    },
    env: {
        api_key: process.env.AXISCARE_API_KEY,
    },
};

module.exports = { Definition };
