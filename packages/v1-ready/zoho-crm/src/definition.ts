import * as dotenv from 'dotenv';
dotenv.config();
import {Api} from './api';
import {get} from '@friggframework/core';
import * as config from '../defaultConfig.json';

export const Definition = {
    API: Api,
    getName: function() {
        return config.name;
    },
    moduleName: config.name,
    requiredAuthMethods: {
        getToken: async function(api: Api, params: any): Promise<void> {
            const code = get(params.data, 'code');
            await api.getTokenFromCode(code);
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        getCredentialDetails: async function (api: Api, userId: string): Promise<any> {
            const response = await api.listUsers({type: 'CurrentUser'});
            const currentUser = response.users[0];
            return {
                identifiers: {externalId: currentUser.id, user: userId},
                details: {},
            };
        },
        getEntityDetails: async function (api: Api, callbackParams: any, tokenResponse: any, userId: string): Promise<any> {
            const response = await api.listUsers({type: 'CurrentUser'});
            const currentUser = response.users[0];
            return {
                identifiers: {externalId: currentUser.id, user: userId},
                details: {
                    name: currentUser.email
                },
            };
        },
        testAuthRequest: async function(api: Api): Promise<any> {
            return await api.listUsers();
        },
    },
    env: {
        client_id: process.env.ZOHO_CRM_CLIENT_ID,
        client_secret: process.env.ZOHO_CRM_CLIENT_SECRET,
        scope: process.env.ZOHO_CRM_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/zoho-crm`,
    }
};
