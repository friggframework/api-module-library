import { Api } from './api';
import { get, FriggModuleAuthDefinition } from '@friggframework/core';
import config from '../defaultConfig.json';
import { ClioRegion } from './types';

const Definition: FriggModuleAuthDefinition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Clio',
    requiredAuthMethods: {
        getToken: async (
            api: Api,
            params: { code: string; region?: ClioRegion },
        ) => {
            const code = get(params, 'code');

            if (!code) {
                throw new Error('Authorization code is required');
            }

            // The code is only redeemable in the region that issued it.
            const region = get(params, 'region', null);
            if (region) {
                api.setRegion(region);
            }
            if (!api.client_id || !api.client_secret) {
                const prefix = `CLIO_${api.region.toUpperCase()}`;
                throw new Error(
                    `Clio ${api.region} client is not configured (set ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET)`,
                );
            }

            try {
                return await api.getTokenFromCode(code);
            } catch (error: any) {
                const message = error.message || 'Unknown error';
                throw new Error(`Clio OAuth token exchange failed: ${message}`);
            }
        },

        getEntityDetails: async (
            api: Api,
            callbackParams: any,
            tokenResponse: any,
            userId: string,
        ) => {
            try {
                const userResponse = await api.getUser();

                if (!userResponse || !userResponse.data) {
                    throw new Error(
                        `Clio /users/who_am_i failed to return valid user info. Response: ${JSON.stringify(
                            userResponse,
                        )}`,
                    );
                }

                const userData = userResponse.data;

                return {
                    identifiers: {
                        externalId: String(userData.id),
                        userId: userId,
                    },
                    details: {
                        name:
                            userData.name ||
                            [userData.first_name, userData.last_name]
                                .filter(Boolean)
                                .join(' ') ||
                            'Unknown User',
                        email: userData.email,
                        region: api.region,
                    },
                };
            } catch (error: any) {
                throw new Error(
                    `Failed to get Clio entity details: ${error.message}`,
                );
            }
        },

        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: ['region'],
        },

        getCredentialDetails: async (api: Api, userId: string) => {
            try {
                const userResponse = await api.getUser();

                if (!userResponse || !userResponse.data) {
                    throw new Error(
                        `Clio /users/who_am_i failed to return valid user info. Response: ${JSON.stringify(
                            userResponse,
                        )}`,
                    );
                }

                return {
                    identifiers: {
                        externalId: String(userResponse.data.id),
                        userId: userId,
                    },
                    details: {},
                };
            } catch (error: any) {
                throw new Error(
                    `Failed to get Clio credential details: ${error.message}`,
                );
            }
        },

        testAuthRequest: async (api: Api) => api.getUser(),
    },

    getEntityOptions: () => ({
        jsonSchema: {
            title: 'Clio Configuration',
            type: 'object',
            properties: {
                region: {
                    type: 'string',
                    title: 'Region',
                    enum: ['us', 'eu', 'ca', 'au'],
                    enumNames: [
                        'United States',
                        'Europe',
                        'Canada',
                        'Australia',
                    ],
                    default: 'us',
                    description:
                        'Select the Clio region where your account is located',
                },
            },
        },
        uiSchema: {
            region: {
                'ui:widget': 'select',
            },
        },
    }),

    refreshEntityOptions: async (
        api: Api,
        options: { region?: ClioRegion },
    ) => {
        if (options.region) {
            api.setRegion(options.region);
        }
    },

    env: {
        client_id: process.env.CLIO_CLIENT_ID,
        client_secret: process.env.CLIO_CLIENT_SECRET,
        redirect_uri: `${process.env.REDIRECT_URI}/clio`,
        eu_client_id: process.env.CLIO_EU_CLIENT_ID,
        eu_client_secret: process.env.CLIO_EU_CLIENT_SECRET,
        ca_client_id: process.env.CLIO_CA_CLIENT_ID,
        ca_client_secret: process.env.CLIO_CA_CLIENT_SECRET,
        au_client_id: process.env.CLIO_AU_CLIENT_ID,
        au_client_secret: process.env.CLIO_AU_CLIENT_SECRET,
        // Note: Clio scopes are configured directly in the Developer Portal, not via OAuth scope.
    },
};

export { Definition };
