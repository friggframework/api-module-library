import * as dotenv from 'dotenv';
dotenv.config();
import {Api} from './api';
import {get} from '@friggframework/core';
import * as config from './defaultConfig.json';
import {ZohoLocation} from './types';

export const Definition = {
    API: Api,
    getName: function() {
        return config.name;
    },
    moduleName: config.name,
    requiredAuthMethods: {
        getToken: async function (api: Api, params: any): Promise<void> {
            console.log("[zoho]: Auth params received:", JSON.stringify(params));
            const code = get(params, 'code');
            const location = get(params, 'location', null) as ZohoLocation | null;
            const accountsServer = get(params, 'accounts-server', null) as string | null;

            if (location) {
                api.setLocation(location);
            }
            if (accountsServer) {
                api.setAccountsServer(accountsServer);
            }

            await api.getTokenFromCode(code);
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: ['location', 'accountsServer'],
        },
        getCredentialDetails: async function (api: Api, userId: string): Promise<any> {
            const response = await api.listUsers({type: 'CurrentUser'});
            const currentUser = response.users[0];
            return {
                identifiers: {externalId: currentUser.id, userId},
                details: {},
            };
        },
        getEntityDetails: async function (api: Api, callbackParams: any, tokenResponse: any, userId: string): Promise<any> {
            const response = await api.listUsers({type: 'CurrentUser'});
            const currentUser = response.users[0];
            return {
                identifiers: {externalId: currentUser.id, userId},
                details: {
                    name: currentUser.email,
                    location: api.location,
                    accountsServer: api.accountsServer,
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
        redirect_uri: `${process.env.REDIRECT_URI}/zohoCrm`,
    }
};
