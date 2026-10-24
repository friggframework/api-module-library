require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

/**
 * Resolve a stable account identity from RingCentral.
 * Prefer account.id from readAccountInfo(~); fall back to the authorized
 * extension id from readExtension(~, ~). Never invent a shared constant.
 */
async function resolveAccountIdentity(api) {
    try {
        const account = await api.readAccountInfo('~');
        if (account?.id !== undefined && account?.id !== null) {
            return {
                externalId: String(account.id),
                name:
                    account.mainNumber ||
                    account.serviceInfo?.servicePlanName ||
                    account.operator?.name ||
                    `RingCentral ${account.id}`,
                accountId: String(account.id),
            };
        }
    } catch (_e) {
        // fall through to extension identity
    }

    const extension = await api.readExtension('~', '~');
    if (extension?.id === undefined || extension?.id === null) {
        throw new Error(
            'RingCentral: cannot derive a stable account identity — readAccountInfo and readExtension returned no id.'
        );
    }
    const name =
        extension.name ||
        [extension.contact?.firstName, extension.contact?.lastName]
            .filter(Boolean)
            .join(' ') ||
        extension.contact?.email ||
        `RingCentral extension ${extension.id}`;
    return {
        externalId: String(extension.id),
        name,
        extensionId: String(extension.id),
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'RingCentral',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            if (!code) {
                throw new Error(
                    'RingCentral OAuth callback missing authorization code'
                );
            }
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    ...(identity.accountId
                        ? { accountId: identity.accountId }
                        : {}),
                    ...(identity.extensionId
                        ? { extensionId: identity.extensionId }
                        : {}),
                },
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
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
            ],
            entity: [],
        },

        testAuthRequest: async (api) => api.readExtension('~', '~'),
    },
    env: {
        client_id: process.env.RINGCENTRAL_CLIENT_ID,
        client_secret: process.env.RINGCENTRAL_CLIENT_SECRET,
        scope: process.env.RINGCENTRAL_SCOPE,
        // Omit when unset so schema validation does not see the string "undefined/ringcentral".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/ringcentral`
            : undefined,
        base_url: process.env.RINGCENTRAL_BASE_URL,
    },
};

module.exports = { Definition };
