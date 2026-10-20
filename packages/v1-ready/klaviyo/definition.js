require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Klaviyo private-API-key authentication.
 *
 * Identity comes from GET /api/accounts/ (official operationId get_accounts).
 * The account `id` is the stable external identifier (same public account /
 * site ID used in webhook `meta.klaviyo_account_id`). Organization name is
 * taken from `attributes.contact_information.organization_name` when present.
 *
 * OAuth (PKCE) is required for Klaviyo App Marketplace listing and is noted as
 * an open question — this module ships private-key auth first, matching the
 * documented server-side `/api` private-key header scheme.
 *
 * Docs:
 *   https://developers.klaviyo.com/en/docs/authenticate_
 *   https://developers.klaviyo.com/en/reference/get_accounts
 */
async function resolveAccountIdentity(api) {
    const result = await api.listAccounts({});
    const account = Array.isArray(result?.data) ? result.data[0] : null;
    if (!account?.id) {
        throw new Error(
            'Klaviyo: GET /api/accounts/ returned no account id — cannot derive a stable entity identifier.'
        );
    }
    const contact = account.attributes?.contact_information || {};
    const name =
        contact.organization_name ||
        contact.default_sender_name ||
        contact.default_sender_email ||
        account.id;
    return { externalId: String(account.id), name };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Klaviyo',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Klaviyo Authentication',
                    type: 'object',
                    required: ['api_key'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'Private API Key',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Create a private API key in Klaviyo under Settings → API keys. Sent as Authorization: Klaviyo-API-Key <key>. Prefix is typically pk_.',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'access_token', null) ||
                get(params?.data || {}, 'api_key', null);
            api.setApiKey(apiKey);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
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
            credential: ['api_key'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.listAccounts({});
        },
    },
    env: {
        api_key: process.env.KLAVIYO_API_KEY,
    },
};

module.exports = { Definition };
