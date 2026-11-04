require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const { credentialExternalId } = require('./credential-id');
const config = require('./defaultConfig.json');

/**
 * Mercury is API-token authenticated (Authorization: Bearer). There is no
 * dedicated "/me" identity endpoint on the public REST API, so identity is
 * derived from the first account returned by GET /accounts (id +
 * legalBusinessName / name).
 *
 * When no account is available we fall back to a sha256 fingerprint of the
 * raw API token — a stable, non-reversible, per-credential identifier.
 * There is deliberately NO shared constant fallback: two different customers
 * must never map to the same entity/credential.
 */
const keyFingerprint = (apiKey) =>
    crypto.createHash('sha256').update(String(apiKey)).digest('hex');

async function resolveAccountIdentity(api) {
    try {
        const result = await api.getAccounts({});
        const accounts = Array.isArray(result?.accounts) ? result.accounts : [];
        const primary = accounts[0];
        if (primary?.id) {
            return {
                externalId: String(primary.id),
                name:
                    primary.legalBusinessName ||
                    primary.name ||
                    primary.nickname ||
                    String(primary.id),
                accountType: primary.type,
                accountKind: primary.kind,
            };
        }
    } catch (_e) {
        // fall through to the per-credential key fingerprint
    }

    const raw = api?.api_key_raw;
    if (!raw) {
        throw new Error(
            'Mercury: cannot derive a stable account identity — no account id and no API key to fingerprint.'
        );
    }
    return { externalId: keyFingerprint(raw), name: 'Mercury' };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Mercury',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Mercury Authentication',
                    type: 'object',
                    required: ['api_key'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'API Token',
                            description:
                                'Mercury API token from Settings → Tokens (include the secret-token: prefix). Sent as Authorization: Bearer.',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Create a token in Mercury under Settings → Tokens. Prefer a read-only token unless you need write scopes. Sent as Authorization: Bearer <token>.',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'apiKey', null) ||
                get(params, 'access_token', null);
            api.setApiToken(apiKey);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    accountType: identity.accountType,
                    accountKind: identity.accountKind,
                },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: {
                    externalId: credentialExternalId(
                        'mercury',
                        identity.externalId,
                        userId
                    ),
                    userId,
                },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['api_key_raw'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            // Any authenticated call proves the token works.
            return api.getAccounts({});
        },
    },
    env: {
        api_key: process.env.MERCURY_API_KEY,
    },
};

module.exports = { Definition };
