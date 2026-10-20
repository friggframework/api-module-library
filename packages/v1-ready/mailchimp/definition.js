require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Mailchimp Definition — OAuth 2.0 primary (Marketplace requirement).
 * API key remains supported on the Api class when `api_key` is set and no
 * access_token is present (see api.js addAuthHeaders).
 *
 * Identity: GET / (API root) → `account_id` as externalId.
 *
 * After OAuth code exchange, Api.getTokenFromCode calls the OAuth metadata
 * endpoint to discover `dc` / server_prefix and sets baseUrl to
 * https://{dc}.api.mailchimp.com/3.0. Persist `server_prefix` on the
 * credential so later requests keep the correct host.
 *
 * Docs:
 *   https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/
 *   https://mailchimp.com/developer/marketing/api/root/list
 *   https://mailchimp.com/developer/marketing/docs/fundamentals/
 */
async function resolveAccountIdentity(api) {
    const account = await api.getAccount({});
    if (!account?.account_id) {
        throw new Error(
            'Mailchimp: GET / returned no account_id — cannot derive a stable entity identifier. Response: ' +
                JSON.stringify(account)
        );
    }
    const name =
        account.account_name ||
        account.username ||
        account.email ||
        account.account_id;
    return { externalId: String(account.account_id), name };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Mailchimp',
    requiredAuthMethods: {
        getAuthorizationRequirements: function () {
            const api =
                this.api ||
                new Api({
                    client_id: Definition.env.client_id,
                    client_secret: Definition.env.client_secret,
                    redirect_uri: Definition.env.redirect_uri,
                });
            return api.getAuthorizationRequirements();
        },
        getToken: async function (api, params) {
            const code = get(params, 'code');
            return api.getTokenFromCode(code);
        },
        // Optional API-key path for non-OAuth installs.
        setAuthParams: async function (api, params) {
            const data = (params && params.data) || {};
            const apiKey =
                get(params, 'api_key', null) || get(data, 'api_key', null);
            const serverPrefix =
                get(params, 'server_prefix', null) ||
                get(data, 'server_prefix', null) ||
                get(params, 'dc', null) ||
                get(data, 'dc', null);

            if (apiKey) {
                api.setApiKey(apiKey);
            }
            if (serverPrefix) {
                api.setServerPrefix(serverPrefix);
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
                details: {
                    name: identity.name,
                    server_prefix: api.server_prefix || null,
                },
            };
        },
        getCredentialDetails: async function (api, userId) {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    server_prefix: api.server_prefix || null,
                },
            };
        },
        apiPropertiesToPersist: {
            // No refresh_token — Mailchimp OAuth tokens do not expire.
            credential: ['access_token', 'api_key', 'server_prefix'],
            entity: [],
        },
        testAuthRequest: async function (api) {
            return api.ping();
        },
    },
    env: {
        client_id: process.env.MAILCHIMP_CLIENT_ID,
        client_secret: process.env.MAILCHIMP_CLIENT_SECRET,
        // Only set when REDIRECT_URI is present so unset env does not become
        // the non-URI string "undefined/mailchimp" (schema format: uri).
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/mailchimp`
            : undefined,
        api_key: process.env.MAILCHIMP_API_KEY,
        // Data-center host override when not discoverable from OAuth metadata
        // or the API-key suffix. Persisted on the credential as server_prefix;
        // env uses base_url (allowed by the api-module-definition schema).
        base_url: process.env.MAILCHIMP_BASE_URL,
    },
};

module.exports = { Definition };
