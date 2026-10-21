require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * DrChrono OAuth2 module definition.
 *
 * After token exchange, identify the connected account via GET /api/users/current.
 * Prefer practice_group (stable per practice) as externalId; fall back to user id.
 *
 * Docs: https://app.drchrono.com/api-docs/v2/documentation (users_read)
 */
async function resolveAccountIdentity(api) {
    const user = await api.getCurrentUser();
    if (!user || user.id === undefined || user.id === null) {
        throw new Error(
            'DrChrono users/current failed to return a valid user id. Response: ' +
                JSON.stringify(user)
        );
    }

    let practiceName;
    try {
        const doctors = await api.listDoctors({});
        const rows = Array.isArray(doctors?.data)
            ? doctors.data
            : Array.isArray(doctors?.results)
              ? doctors.results
              : [];
        practiceName = rows[0]?.practice_group_name;
    } catch (_err) {
        // optional enrichment
    }

    const practiceGroup = user.practice_group;
    const externalId = practiceGroup
        ? String(practiceGroup)
        : String(user.id);

    return {
        externalId,
        name:
            practiceName ||
            user.username ||
            (practiceGroup ? `practice-${practiceGroup}` : `user-${user.id}`),
        username: user.username,
        email: user.email,
        practiceGroup: practiceGroup ? String(practiceGroup) : undefined,
        userId: String(user.id),
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'DrChrono',
    mappings: {
        business: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: function () {
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
        getToken: async (api, params) => {
            const code = get(params.data, 'code') || get(params, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    username: identity.username,
                    email: identity.email,
                    practiceGroup: identity.practiceGroup,
                    drchronoUserId: identity.userId,
                },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    username: identity.username,
                },
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
        testAuthRequest: async (api) => {
            return api.getCurrentUser();
        },
    },
    env: {
        client_id: process.env.DRCHRONO_CLIENT_ID,
        client_secret: process.env.DRCHRONO_CLIENT_SECRET,
        redirect_uri:
            process.env.DRCHRONO_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/drchrono`
                : undefined),
        scope:
            process.env.DRCHRONO_SCOPE ||
            'patients:read patients:write billing:read billing:write',
    },
};

module.exports = { Definition };
