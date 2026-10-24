require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Digitail OAuth2 module definition.
 *
 * After token exchange, identify the connected account via GET /auth/me.
 * Prefer clinic.id (with include=clinic) as externalId; fall back to user id.
 *
 * Docs: https://documentation.digitail.io/get-the-logged-in-user-vet
 * Auth: https://documentation.digitail.io/6-ex-authentication
 */
async function resolveIdentity(api) {
    const response = await api.getAuthMe({
        'include[]': ['clinic', 'employee'],
    });
    const data = response?.data || response || {};
    const clinic = data.clinic;
    const externalId = clinic?.id != null ? String(clinic.id) : String(data.id);
    if (!externalId || externalId === 'undefined' || externalId === 'null') {
        throw new Error(
            'Digitail auth/me failed to return a clinic id or user id. ' +
                'Response: ' +
                JSON.stringify(response)
        );
    }
    const name =
        clinic?.name ||
        data.full_name ||
        data.name_with_title ||
        [data.first_name, data.last_name].filter(Boolean).join(' ') ||
        externalId;
    return { externalId, name, email: data.email, clinicId: clinic?.id };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Digitail',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) => {
            const client =
                api ||
                new Api({
                    client_id: process.env.DIGITAIL_CLIENT_ID,
                    client_secret: process.env.DIGITAIL_CLIENT_SECRET,
                    redirect_uri:
                        process.env.DIGITAIL_REDIRECT_URI ||
                        (process.env.REDIRECT_URI
                            ? `${process.env.REDIRECT_URI}/digitail`
                            : undefined),
                });
            return {
                url: client.getAuthUri(),
                type: 'oauth2',
                data: {},
            };
        },
        getToken: async (api, params) => {
            const code =
                get(params.data, 'code') ||
                get(params, 'code');
            const state =
                get(params.data, 'state') ||
                get(params, 'state');
            const code_verifier =
                get(params.data, 'code_verifier') ||
                get(params, 'code_verifier');
            return api.getTokenFromCode(code, { state, code_verifier });
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveIdentity(api);
            if (identity.clinicId != null) {
                api.setClinicId(identity.clinicId);
            }
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name, email: identity.email },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveIdentity(api);
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
            return api.getAuthMe();
        },
    },
    env: {
        client_id: process.env.DIGITAIL_CLIENT_ID,
        client_secret: process.env.DIGITAIL_CLIENT_SECRET,
        // Dedicated Digitail redirect URI (preferred). Falls back to shared REDIRECT_URI/digitail; omitted when neither is set.
        redirect_uri:
            process.env.DIGITAIL_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/digitail`
                : undefined),
    },
};

module.exports = { Definition };
