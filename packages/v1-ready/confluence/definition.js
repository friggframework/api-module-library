require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve a stable Confluence Cloud site identity for entity/credential keys.
 * Prefer a persisted cloudId; otherwise resolve via accessible-resources.
 */
async function resolveSiteIdentity(api) {
    if (api.cloudId) {
        return {
            externalId: String(api.cloudId),
            name: api.siteName || api.siteUrl || 'Confluence',
        };
    }

    const site = await api.resolveCloudId({
        siteUrl: api.siteUrl || undefined,
    });
    return {
        externalId: String(site.id),
        name: site.name || site.url || 'Confluence',
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Confluence',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) || get(params, 'data.code', null);
            const tokenResponse = await api.getTokenFromCode(code);

            // Prefer an explicit site URL from the callback/form if present.
            const siteUrl =
                get(params, 'siteUrl', null) ||
                get(params, 'site_url', null) ||
                get(params, 'data.siteUrl', null) ||
                get(params, 'data.site_url', null) ||
                api.siteUrl;

            try {
                await api.resolveCloudId({ siteUrl: siteUrl || undefined });
            } catch (e) {
                // Leave cloudId unset; getEntityDetails will retry / surface.
            }

            return {
                ...tokenResponse,
                cloudId: api.cloudId,
                siteUrl: api.siteUrl,
                siteName: api.siteName,
            };
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            if (!api.cloudId) {
                const fromToken =
                    get(tokenResponse, 'cloudId', null) ||
                    get(tokenResponse, 'cloud_id', null);
                if (fromToken) {
                    api.setCloudId(fromToken, {
                        siteUrl:
                            get(tokenResponse, 'siteUrl', null) ||
                            get(tokenResponse, 'site_url', null),
                        siteName:
                            get(tokenResponse, 'siteName', null) ||
                            get(tokenResponse, 'site_name', null),
                    });
                }
            }
            const identity = await resolveSiteIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
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
                'siteUrl',
                'siteName',
            ],
            entity: ['cloudId'],
        },

        testAuthRequest: async (api) => {
            if (!api.cloudId) {
                await api.resolveCloudId();
            }
            // Any authenticated Confluence v2 call proves the token + cloudId.
            return api.getSpaces({ limit: 1 });
        },
    },
    env: {
        client_id: process.env.CONFLUENCE_CLIENT_ID,
        client_secret: process.env.CONFLUENCE_CLIENT_SECRET,
        scope: process.env.CONFLUENCE_SCOPE,
        // Omit when unset so schema validation does not see the string "undefined/confluence".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/confluence`
            : undefined,
    },
};

module.exports = { Definition };
