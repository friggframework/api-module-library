import FormData = require('form-data');
import {OAuth2Requester, get} from '@friggframework/core';
import {
    ZohoConfig,
    QueryParams,
    SearchParams,
    UsersResponse,
    RolesResponse,
    ProfilesResponse,
    ContactsResponse,
    ContactResponse,
    LeadsResponse,
    LeadResponse,
    AccountsResponse,
    AccountResponse,
    TokenResponse,
} from './types';

export class Api extends OAuth2Requester {
    public URLs: Record<string, string | ((id: string) => string)>;

    private static readonly CONTACTS_DEFAULT_FIELDS = 'id,First_Name,Last_Name,Email,Phone,Mobile,Account_Name,Company,Owner,Lead_Source,Created_Time,Modified_Time';
    private static readonly LEADS_DEFAULT_FIELDS = 'id,First_Name,Last_Name,Email,Phone,Mobile,Company,Industry,Lead_Source,Lead_Status,Owner,Created_Time,Modified_Time,Converted__s,Converted_Date_Time';
    private static readonly ACCOUNTS_DEFAULT_FIELDS = 'id,Account_Name,Account_Number,Account_Type,Industry,Annual_Revenue,Rating,Phone,Fax,Website,Parent_Account,Owner,Billing_City,Billing_State,Billing_Country,Shipping_City,Shipping_State,Shipping_Country,Created_Time,Modified_Time';

    constructor(params: ZohoConfig) {
        super(params);
        this.baseUrl = 'https://www.zohoapis.com/crm/v8';
        this.authorizationUri = encodeURI(
            `https://accounts.zoho.com/oauth/v2/auth?scope=${this.scope}&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&access_type=offline`
        );
        this.tokenUri = 'https://accounts.zoho.com/oauth/v2/token';
        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.URLs = {
            users: '/users',
            user: (userId: string) => `/users/${userId}`,
            roles: '/settings/roles',
            role: (roleId: string) => `/settings/roles/${roleId}`,
            profiles: '/settings/profiles',
            contacts: '/Contacts',
            contact: (contactId: string) => `/Contacts/${contactId}`,
            contactSearch: '/Contacts/search',
            leads: '/Leads',
            lead: (leadId: string) => `/Leads/${leadId}`,
            leadSearch: '/Leads/search',
            accounts: '/Accounts',
            account: (accountId: string) => `/Accounts/${accountId}`,
            accountSearch: '/Accounts/search',
        };
    }

    getAuthUri(): string {
        return this.authorizationUri;
    }

    async getTokenFromCode(code: string): Promise<TokenResponse> {
        const formData = new FormData();
        formData.append('grant_type', 'authorization_code');
        formData.append('client_id', this.client_id);
        formData.append('client_secret', this.client_secret);
        formData.append('redirect_uri', this.redirect_uri);
        formData.append('scope', this.scope);
        formData.append('code', code);
        const options = {
            body: formData,
            headers: (formData as any).getHeaders(),
            url: this.tokenUri,
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    async _delete(options: any): Promise<any> {
        const response = await super._delete(options);
        return await this.parsedBody(response);
    }

    async listUsers(queryParams: QueryParams = {}): Promise<UsersResponse> {
        return this._get({
            url: this.baseUrl + this.URLs.users,
            query: {...queryParams},
        });
    }

    async getUser(userId: string): Promise<UsersResponse> {
        if (!userId) {
            throw new Error('userId is required');
        }
        return this._get({
            url: this.baseUrl + (this.URLs.user as (id: string) => string)(userId),
        });
    }

    async createUser(body: any = {}): Promise<any> {
        if (!body || Object.keys(body).length === 0) {
            throw new Error('Request body is required');
        }
        return this._post({
            url: this.baseUrl + this.URLs.users,
            body: body
        });
    }

    async updateUser(userId: string, body: any = {}): Promise<any> {
        if (!userId) {
            throw new Error('userId is required');
        }
        if (!body || Object.keys(body).length === 0) {
            throw new Error('Request body is required');
        }
        return this._put({
            url: this.baseUrl + (this.URLs.user as (id: string) => string)(userId),
            body: body,
        });
    }

    async deleteUser(userId: string): Promise<any> {
        if (!userId) {
            throw new Error('userId is required');
        }
        return this._delete({
            url: this.baseUrl + (this.URLs.user as (id: string) => string)(userId),
        });
    }

    async listRoles(): Promise<RolesResponse> {
        return this._get({
            url: this.baseUrl + this.URLs.roles
        });
    }

    async getRole(roleId: string): Promise<RolesResponse> {
        if (!roleId) {
            throw new Error('roleId is required');
        }
        return this._get({
            url: this.baseUrl + (this.URLs.role as (id: string) => string)(roleId)
        });
    }

    async createRole(body: any = {}): Promise<any> {
        if (!body || Object.keys(body).length === 0) {
            throw new Error('Request body is required');
        }
        return this._post({
            url: this.baseUrl + this.URLs.roles,
            body: body
        });
    }

    async updateRole(roleId: string, body: any = {}): Promise<any> {
        if (!roleId) {
            throw new Error('roleId is required');
        }
        if (!body || Object.keys(body).length === 0) {
            throw new Error('Request body is required');
        }
        return this._put({
            url: this.baseUrl + (this.URLs.role as (id: string) => string)(roleId),
            body: body,
        });
    }

    async deleteRole(roleId: string, queryParams: any = {}): Promise<any> {
        if (!roleId) {
            throw new Error('roleId is required');
        }
        return this._delete({
            url: this.baseUrl + (this.URLs.role as (id: string) => string)(roleId),
            query: {...queryParams},
        });
    }

    async listProfiles(): Promise<ProfilesResponse> {
        return this._get({
            url: this.baseUrl + this.URLs.profiles
        });
    }

    async listContacts(queryParams: QueryParams = {}): Promise<ContactsResponse> {
        const params = {
            fields: Api.CONTACTS_DEFAULT_FIELDS,
            ...queryParams,
        };

        try {
            return await this._get({
                url: this.baseUrl + this.URLs.contacts,
                query: params,
            });
        } catch (error) {
            throw error;
        }
    }

    async getContact(contactId: string): Promise<ContactResponse> {
        if (!contactId) {
            throw new Error('contactId is required');
        }
        try {
            return await this._get({
                url: this.baseUrl + (this.URLs.contact as (id: string) => string)(contactId),
            });
        } catch (error) {
            throw error;
        }
    }

    async searchContacts(searchParams: SearchParams = {}): Promise<ContactsResponse> {
        if (!searchParams || Object.keys(searchParams).length === 0) {
            throw new Error('At least one search parameter is required (email, phone, criteria, or word)');
        }

        const params = {
            fields: Api.CONTACTS_DEFAULT_FIELDS,
            ...searchParams,
        };

        try {
            return await this._get({
                url: this.baseUrl + this.URLs.contactSearch,
                query: params,
            });
        } catch (error) {
            throw error;
        }
    }

    async listLeads(queryParams: QueryParams = {}): Promise<LeadsResponse> {
        const params = {
            fields: Api.LEADS_DEFAULT_FIELDS,
            ...queryParams,
        };

        try {
            return await this._get({
                url: this.baseUrl + this.URLs.leads,
                query: params,
            });
        } catch (error) {
            throw error;
        }
    }

    async getLead(leadId: string): Promise<LeadResponse> {
        if (!leadId) {
            throw new Error('leadId is required');
        }
        try {
            return await this._get({
                url: this.baseUrl + (this.URLs.lead as (id: string) => string)(leadId),
            });
        } catch (error) {
            throw error;
        }
    }

    async searchLeads(searchParams: SearchParams = {}): Promise<LeadsResponse> {
        if (!searchParams || Object.keys(searchParams).length === 0) {
            throw new Error('At least one search parameter is required (email, phone, criteria, or word)');
        }

        const params = {
            fields: Api.LEADS_DEFAULT_FIELDS,
            ...searchParams,
        };

        try {
            return await this._get({
                url: this.baseUrl + this.URLs.leadSearch,
                query: params,
            });
        } catch (error) {
            throw error;
        }
    }

    async listAccounts(queryParams: QueryParams = {}): Promise<AccountsResponse> {
        const params = {
            fields: Api.ACCOUNTS_DEFAULT_FIELDS,
            ...queryParams,
        };

        try {
            return await this._get({
                url: this.baseUrl + this.URLs.accounts,
                query: params,
            });
        } catch (error) {
            throw error;
        }
    }

    async getAccount(accountId: string): Promise<AccountResponse> {
        if (!accountId) {
            throw new Error('accountId is required');
        }
        try {
            return await this._get({
                url: this.baseUrl + (this.URLs.account as (id: string) => string)(accountId),
            });
        } catch (error) {
            throw error;
        }
    }

    async searchAccounts(searchParams: SearchParams = {}): Promise<AccountsResponse> {
        if (!searchParams || Object.keys(searchParams).length === 0) {
            throw new Error('At least one search parameter is required (email, phone, criteria, or word)');
        }

        const params = {
            fields: Api.ACCOUNTS_DEFAULT_FIELDS,
            ...searchParams,
        };

        try {
            return await this._get({
                url: this.baseUrl + this.URLs.accountSearch,
                query: params,
            });
        } catch (error) {
            throw error;
        }
    }
}
