require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Klaviyo Definition — OAuth 2.0 + PKCE primary (App Marketplace / lefthook
 * manifest). Private API key remains supported on the Api class when
 * `api_key` is set and no access_token is present (see api.js addAuthHeaders).
 *
 * Identity: GET /api/accounts/ → account `id` as externalId.
 *
 * Docs:
 *   https://developers.klaviyo.com/en/docs/set_up_oauth
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
        getAuthorizationRequirements: function () {
            // Prefer the live Api instance when Frigg has wired one; otherwise
            // build a throwaway client from env so the auth URL is still usable.
            const api =
                this.api ||
                new Api({
                    client_id: Definition.env.client_id,
                    client_secret: Definition.env.client_secret,
                    redirect_uri: Definition.env.redirect_uri,
                    scope: Definition.env.scope,
                });
            return api.getAuthorizationRequirements();
        },
        getToken: async function (api, params) {
            const code = get(params, 'code');
            const state = get(params, 'state', null);
            const explicitVerifier =
                get(params, 'code_verifier', null) ||
                get(params?.data || {}, 'code_verifier', null);
            if (explicitVerifier) {
                api.code_verifier = explicitVerifier;
            } else if (state) {
                api.restorePkceFromState(state);
            }
            return api.getTokenFromCode(code);
        },
        // Optional private-key path for non-OAuth installs. Cleanly alongside
        // OAuth: only applied when api_key is present in the form/params.
        setAuthParams: async function (api, params) {
            const data = (params && params.data) || {};
            const apiKey =
                get(params, 'api_key', null) ||
                get(data, 'api_key', null);
            if (apiKey) {
                api.setApiKey(apiKey);
            }
            return api;
        },
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },
        getCredentialDetails: async function (api, userId) {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token', 'api_key'],
            entity: [],
        },
        testAuthRequest: async function (api) {
            return api.listAccounts({});
        },
    },
    env: {
        client_id: process.env.KLAVIYO_CLIENT_ID,
        client_secret: process.env.KLAVIYO_CLIENT_SECRET,
        scope: process.env.KLAVIYO_SCOPE,
        // Omit when unset so schema validation does not see the string "undefined/klaviyo".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/klaviyo`
            : undefined,
        api_key: process.env.KLAVIYO_API_KEY,
    },
};

module.exports = { Definition };
