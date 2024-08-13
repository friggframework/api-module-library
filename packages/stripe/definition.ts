require('dotenv').config();
import { Api } from './api';
import { get } from '@friggframework/core';
import config from './defaultConfig.json';

export const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Asana',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId,
        ) {
            const userDetails = await api.getUserDetails();
            return {
                identifiers: { externalId: userDetails.sub, user: userId },
                details: { name: userDetails.name, email: userDetails.email },
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const userDetails = await api.getUserDetails();
            return {
                identifiers: { externalId: userDetails.portalId, user: userId },
                details: {},
            };
        },
        testAuthRequest: async function (api) {
            return api.getUserDetails();
        },
    },
    env: {
        stripeApiSecretKey: process.env.STRIPE_API_SECRET_KEY,
        stripeClientId: process.env.STRIPE_CLIENT_ID,
        redirect_uri: `${process.env.REDIRECT_URI}/stripe`,
    },
};
