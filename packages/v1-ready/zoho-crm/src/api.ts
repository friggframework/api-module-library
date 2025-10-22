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
    TokenResponse,
} from './types';

export class Api extends OAuth2Requester {
    public URLs: Record<string, string | ((id: string) => string)>;

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

    private addJsonHeaders(options: any): void {
        const jsonHeaders = {
            'content-type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        };
    }

    async _get(options: any, stringify?: boolean): Promise<any> {
        this.addJsonHeaders(options);
        return super._get(options, stringify);
    }

    async _post(options: any, stringify?: boolean): Promise<any> {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _put(options: any, stringify?: boolean): Promise<any> {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    async _delete(options: any): Promise<any> {
        this.addJsonHeaders(options);
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
        try {
            return await this._get({
                url: this.baseUrl + this.URLs.contacts,
                query: {...queryParams},
            });
        } catch (error: any) {
            throw new Error(`Failed to list contacts: ${error.message}`);
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
        } catch (error: any) {
            throw new Error(`Failed to get contact ${contactId}: ${error.message}`);
        }
    }

    async searchContacts(searchParams: SearchParams = {}): Promise<ContactsResponse> {
        if (!searchParams || Object.keys(searchParams).length === 0) {
            throw new Error('At least one search parameter is required (email, phone, criteria, or word)');
        }
        try {
            return await this._get({
                url: this.baseUrl + this.URLs.contactSearch,
                query: {...searchParams},
            });
        } catch (error: any) {
            throw new Error(`Failed to search contacts: ${error.message}`);
        }
    }
}
