import 'dotenv/config';
import { Api } from './api';
import { get } from '@friggframework/core';
import config from './defaultConfig.json';

export interface AuthParams {
    data: {
        api_key?: string;
        [key: string]: any;
    };
}

export interface UserIdParam {
    userId?: string;
}

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Recharge',
    requiredAuthMethods: {
        getToken: async function (_api: Api, params: AuthParams) {
            const api_key = get(params.data, 'api_key');
            if (!api_key) {
                throw new Error('API key is required');
            }
            // For API key auth, we just need to store the key
            return { api_key };
        },

        getEntityDetails: async function (api: Api, _callbackParams: any, _tokenResponse: any, userId: string | UserIdParam) {
            // Get shop details as entity identifier
            const shopDetails = await api.getShop();
            if (typeof userId === 'object' && userId.userId) {
                userId = userId.userId;
            }
            
            return {
                identifiers: { 
                    externalId: shopDetails.shop?.id || shopDetails.id, 
                    user: userId as string 
                },
                details: {
                    name: shopDetails.shop?.name || shopDetails.name,
                    email: shopDetails.shop?.email || shopDetails.email,
                    domain: shopDetails.shop?.domain || shopDetails.domain,
                    timezone: shopDetails.shop?.timezone || shopDetails.timezone,
                    currency: shopDetails.shop?.currency || shopDetails.currency,
                }
            };
        },

        apiPropertiesToPersist: {
            credential: ['api_key'],
            entity: [],
        },

        getCredentialDetails: async function (api: Api, userId: string | UserIdParam) {
            const shopDetails = await api.getShop();
            if (typeof userId === 'object' && userId.userId) {
                userId = userId.userId;
            }
            
            return {
                identifiers: { 
                    externalId: shopDetails.shop?.id || shopDetails.id, 
                    user: userId as string 
                },
                details: {}
            };
        },

        testAuthRequest: function (api: Api) {
            return api.testAuth();
        },
    },
    env: {
        // Recharge uses API key authentication, no OAuth env vars needed
        api_key: process.env.RECHARGE_API_KEY,
    }
};

export default Definition;
export { Definition };