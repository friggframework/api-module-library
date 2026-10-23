require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve the connected Typeform account for entity/credential identity.
 * Official GET /me returns { alias, email, language } (accounts:read).
 * Email is the stable, unique identifier used as externalId.
 *
 * Docs: https://www.typeform.com/developers/get-started/hands-on/
 */
async function resolveAccountIdentity(api) {
    const me = await api.getMe();
    if (!me?.email) {
        throw new Error(
            'Typeform: cannot derive a stable account identity — GET /me did not return an email.'
        );
    }
    return {
        externalId: me.email,
        name: me.alias || me.email,
        email: me.email,
        language: me.language,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Typeform',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) || get(params.data || {}, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    email: identity.email,
                    language: identity.language,
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
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getMe();
        },
    },
    env: {
        client_id: process.env.TYPEFORM_CLIENT_ID,
        client_secret: process.env.TYPEFORM_CLIENT_SECRET,
        scope: process.env.TYPEFORM_SCOPE,
        // Omit when unset so schema validation does not see the string "undefined/typeform".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/typeform`
            : undefined,
        base_url: process.env.TYPEFORM_BASE_URL,
    },
};

module.exports = { Definition };
