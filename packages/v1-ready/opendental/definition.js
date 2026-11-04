require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Open Dental is dual-API-key authenticated
 * (`Authorization: ODFHIR {DeveloperKey}/{CustomerKey}`). There is no OAuth
 * flow and no dedicated practice-identity resource on the public API Service
 * (no `/practices` endpoint in official docs).
 *
 * Identity strategy:
 * - Stable externalId = sha256 of the Customer API Key (unique per
 *   customer/developer pair; never a shared constant).
 * - Display name from preference PrefName=PracticeTitle when available.
 *
 * Docs: https://www.opendental.com/site/apisetup.html
 * Preferences: https://www.opendental.com/site/apipreferences.html
 */
const keyFingerprint = (customerKey) =>
    crypto.createHash('sha256').update(String(customerKey)).digest('hex');

async function resolvePracticeIdentity(api) {
    const customerKey = api?.customerKey;
    if (!customerKey) {
        throw new Error(
            'Open Dental: cannot derive a stable account identity — no customerKey to fingerprint.'
        );
    }

    let name = 'Open Dental';
    try {
        const pref = await api.getPreference('PracticeTitle');
        if (pref?.ValueString) {
            name = pref.ValueString;
        }
    } catch (_err) {
        // fall through — fingerprint alone is enough for identity
    }

    return {
        externalId: keyFingerprint(customerKey),
        name,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'OpenDental',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) => {
            if (api && typeof api.getAuthorizationRequirements === 'function') {
                return api.getAuthorizationRequirements();
            }
            return new Api({}).getAuthorizationRequirements();
        },
        setAuthParams: async (api, params) => {
            const developerKey =
                get(params, 'developerKey', null) ||
                get(params, 'developer_key', null);
            const customerKey =
                get(params, 'customerKey', null) ||
                get(params, 'customer_key', null);
            if (developerKey && customerKey) {
                api.setCredentials(developerKey, customerKey);
            }
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolvePracticeIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolvePracticeIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['developerKey', 'customerKey'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            // Any authenticated call proves the keys work.
            return api.listPreferences({ PrefName: 'PracticeTitle' });
        },
    },
    env: {
        developerKey: process.env.OPENDENTAL_DEVELOPER_KEY,
        customerKey: process.env.OPENDENTAL_CUSTOMER_KEY,
    },
};

module.exports = { Definition };
