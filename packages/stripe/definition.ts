require('dotenv').config();
import { Api } from './api.js';
import { get } from '@friggframework/core';
import config from './defaultConfig.json';

export const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Stripe',
    requiredAuthMethods: {
        getToken: async function (
            api: Api,
            params: { data: { code: string } },
        ) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async function (api: Api, userId: string) {
            const accountDetails = await api.getAccountDetails();
            return {
                identifiers: { externalId: accountDetails.id, user: userId },
                details: {
                    name: accountDetails.business_profile?.name,
                    email: accountDetails.email,
                },
            };
        },

        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },

        getCredentialDetails: async function (api: Api, userId: string) {
            const accountDetails = await api.getAccountDetails();
            return {
                identifiers: { externalId: accountDetails.id, user: userId },
                details: {},
            };
        },

        testAuthRequest: function (api: Api) {
            return api.getAccountDetails();
        },
    },
    env: {
        stripeApiSecretKey: process.env.STRIPE_API_SECRET_KEY,
        stripeClientId: process.env.STRIPE_CLIENT_ID,
        redirect_uri: `${process.env.REDIRECT_URI}/stripe`,
    },
};
