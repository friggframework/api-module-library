import 'dotenv/config'

import { Api } from './api';
import { get } from '@friggframework/core';
import docusignDefaultConfig from './defaultConfig.json';

interface DefaultConfig {
    name: string;
    label: string;
    productUrl: string;
    apiDocs: string;
    logoUrl: string;
    categories: string[];
    description: string;
}

const defaultConfig: DefaultConfig = docusignDefaultConfig;

interface UserDetails {
    sub: string;
    name: string;
    given_name: string;
    family_name: string;
    created: string;
    email: string;
    accounts: {
        account_id: string;
        is_default: boolean;
        account_name: string;
        base_uri: string; // This is the host, e.g., https://demo.docusign.net
    }[];
}

interface TokenResponse {
    access_token: string;
    refresh_token: string;
    [key: string]: any;
}

export const Definition = {
    API: Api,
    getName: function(): string {
        return defaultConfig.name;
    },
    moduleName: defaultConfig.name,
    modelName: 'DocuSign',

    requiredAuthMethods: {
        getToken: async function (api: Api, params: any): Promise<TokenResponse> {
            const code = get(params.data, 'code');
            if (!code) {
                throw new Error('Authorization code not found in callback parameters.');
            }
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async function (
            api: Api,
            callbackParams: any,
            tokenResponse: TokenResponse,
            userId: string
        ): Promise<{ identifiers: { externalId: string; user: string; accountId?: string }, details: { name?: string; email?: string;[key: string]: any } }> {
            const userDetails: UserDetails = await api.getUserInfo();
            const primaryAccount = userDetails.accounts?.find(acc => acc.is_default);
            if (!primaryAccount || !primaryAccount.account_id || !primaryAccount.base_uri) {
                 throw new Error('Could not determine primary account ID and base URI from UserInfo.');
            }
            api.setAccountId(primaryAccount.account_id);

            return {
                identifiers: {
                    externalId: userDetails.sub,
                    user: userId,
                    accountId: primaryAccount.account_id
                },
                details: { name: userDetails.name, email: userDetails.email },
            };
        },

        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: ['accountId', 'base_url'],
        },

        getCredentialDetails: async function (
            api: Api,
            userId: string
        ): Promise<{ identifiers: { externalId: string; user: string; accountId?: string }, details: {} }> {
            const userDetails: UserDetails = await api.getUserInfo();
            const primaryAccount = userDetails.accounts?.find(acc => acc.is_default);
             if (!primaryAccount || !primaryAccount.account_id) {
                 throw new Error('Could not determine primary account ID from UserInfo.');
            }
            return {
                identifiers: {
                    externalId: userDetails.sub,
                    user: userId,
                    accountId: primaryAccount.account_id
                },
                details: {},
            };
        },

        testAuthRequest: async function (api: Api): Promise<any> {
            return api.getUserInfo();
        },
    },

    env: {
        client_id: process.env.DOCUSIGN_CLIENT_ID,
        client_secret: process.env.DOCUSIGN_CLIENT_SECRET,
        scope: process.env.DOCUSIGN_SCOPE,
        redirect_uri: process.env.REDIRECT_URI + '/docusign',
        environment: process.env.DOCUSIGN_ENVIRONMENT || 'dev',
        account_id: process.env.DOCUSIGN_ACCOUNT_ID,
    },
}; 