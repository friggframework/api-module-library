require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Extract the PagerDuty account subdomain from a user/resource html_url
 * (e.g. https://acme.pagerduty.com/users/PXXX → "acme").
 */
function subdomainFromHtmlUrl(htmlUrl) {
    if (!htmlUrl || typeof htmlUrl !== 'string') return null;
    try {
        const host = new URL(htmlUrl).hostname; // acme.pagerduty.com
        const match = host.match(/^([^.]+)\.pagerduty\.com$/i);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

/**
 * Resolve a stable account identity for entity/credential persistence.
 * Prefer account_id / subdomain from the OAuth id_token (captured on the Api
 * instance); fall back to GET /users/me (user id + subdomain from html_url).
 */
async function resolveAccountIdentity(api, tokenResponse) {
    const fromToken = api._decodeJwtPayload?.(
        get(tokenResponse || {}, 'id_token', null)
    );
    const accountId =
        api.account_id ||
        fromToken?.account_id ||
        null;
    const subdomain =
        api.subdomain ||
        fromToken?.subdomain ||
        null;

    try {
        const result = await api.getCurrentUser();
        const user = result?.user;
        if (user?.id) {
            const fromHtml = subdomainFromHtmlUrl(user.html_url);
            return {
                externalId: accountId || fromHtml || user.id,
                name: user.name || user.email || user.id,
                account_id: accountId || null,
                subdomain: subdomain || fromHtml || null,
                user_id: user.id,
            };
        }
    } catch (e) {
        // fall through
    }

    if (accountId || subdomain) {
        return {
            externalId: accountId || subdomain,
            name: subdomain || accountId,
            account_id: accountId,
            subdomain,
            user_id: fromToken?.user_id || api.user_id || null,
        };
    }

    throw new Error(
        'PagerDuty: cannot derive a stable account identity — getCurrentUser failed and no account_id/subdomain is available from the OAuth id_token.'
    );
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'PagerDuty',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) || get(params.data || {}, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api, tokenResponse);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    account_id: identity.account_id,
                    subdomain: identity.subdomain,
                    user_id: identity.user_id,
                },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveAccountIdentity(api, null);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'account_id',
                'subdomain',
            ],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getCurrentUser();
        },
    },
    env: {
        client_id: process.env.PAGERDUTY_CLIENT_ID,
        client_secret: process.env.PAGERDUTY_CLIENT_SECRET,
        scope: process.env.PAGERDUTY_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/pagerduty`,
    },
};

module.exports = { Definition, resolveAccountIdentity, subdomainFromHtmlUrl };
