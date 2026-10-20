require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Jira Cloud is OAuth 2.0 (3LO) authenticated via Atlassian. After token
 * exchange the app must discover the site `cloudId` from
 * GET /oauth/token/accessible-resources and use it in API URLs:
 *   https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...
 *
 * Entity externalId is the cloudId (stable per site). Display name prefers the
 * accessible-resource site name, then the current user's displayName.
 *
 * Docs: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
 */
async function resolveSiteIdentity(api) {
    await api.ensureCloudId(api.cloudId);
    const cloudId = api.cloudId;
    if (!cloudId || cloudId === '{cloudId}') {
        throw new Error(
            'Jira: cannot derive a stable site identity — no cloudId from accessible-resources.'
        );
    }

    let userName = null;
    try {
        const me = await api.getCurrentUser();
        userName = me?.displayName || me?.emailAddress || null;
    } catch (_e) {
        // site metadata alone is enough for identity
    }

    return {
        externalId: String(cloudId),
        name: api.siteName || userName || api.siteUrl || 'Jira',
        siteUrl: api.siteUrl || null,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Jira',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) => ({
            url: api.getAuthorizationUri(),
            type: 'oauth2',
        }),

        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            if (!code) {
                throw new Error('Jira OAuth callback missing authorization code');
            }
            const preferredCloudId =
                get(data, 'cloudId', null) ||
                get(data, 'cloud_id', null) ||
                get(params, 'cloudId', null) ||
                get(params, 'cloud_id', null);

            const tokenResponse = await api.getTokenFromCode(code);
            await api.ensureCloudId(preferredCloudId);
            return tokenResponse;
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const preferred =
                get(callbackParams, 'cloudId', null) ||
                get(callbackParams, 'cloud_id', null) ||
                get(callbackParams?.data, 'cloudId', null);
            if (preferred) api.setCloudId(preferred);
            const identity = await resolveSiteIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    siteUrl: identity.siteUrl,
                    site: api.site || null,
                    cloudId: identity.externalId,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = await resolveSiteIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'cloudId',
                'site',
                'siteUrl',
                'siteName',
                'accessTokenExpire',
                'refreshTokenExpire',
            ],
            entity: [],
        },

        testAuthRequest: async (api) => {
            await api.ensureCloudId(api.cloudId);
            return api.getCurrentUser();
        },
    },
    env: {
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
        scope: process.env.JIRA_SCOPE,
        // Only set when REDIRECT_URI is present — otherwise `${undefined}/jira`
        // fails the api-module-definition schema's `format: uri` check.
        ...(process.env.REDIRECT_URI
            ? { redirect_uri: `${process.env.REDIRECT_URI}/jira` }
            : {}),
    },
};

module.exports = { Definition };
