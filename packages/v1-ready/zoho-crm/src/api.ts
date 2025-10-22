import FormData = require('form-data');
import {OAuth2Requester, get} from '@friggframework/core';

export class Api extends OAuth2Requester {
    constructor(params: any) {
        super(params);
        this.baseUrl = 'https://www.zohoapis.com/crm/v8';
        this.authorizationUri = encodeURI(
            `https://accounts.zoho.com/oauth/v2/auth?scope=${this.scope}&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&access_type=offline`
        );
        this.tokenUri = 'https://accounts.zoho.com/oauth/v2/token';
        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.URLs = {
            // Users
            users: '/users',
            user: (userId: string) => `/users/${userId}`,

            // Roles
            roles: '/settings/roles',
            role: (roleId: string) => `/settings/roles/${roleId}`,

            // Profiles
            profiles: '/settings/profiles',

            // Contacts
            contacts: '/Contacts',
            contact: (contactId: string) => `/Contacts/${contactId}`,
            contactSearch: '/Contacts/search',
        };
    }

    getAuthUri(): string {
        return this.authorizationUri;
    }

    async getTokenFromCode(code: string): Promise<any> {
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

    addJsonHeaders(options: any): void {
        const jsonHeaders = {
            'content-type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        }
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

    // **************************   Users   **********************************
    // https://www.zoho.com/crm/developer/docs/api/v8/get-users.html

    async listUsers(queryParams: any = {}): Promise<any> {
        return this._get({
            url: this.baseUrl + this.URLs.users,
            query: {...queryParams},
        });
    }

    async getUser(userId: string): Promise<any> {
        return this._get({
            url: this.baseUrl + this.URLs.user(userId),
        });
    }

    async createUser(body: any = {}): Promise<any> {
        return this._post({
            url: this.baseUrl + this.URLs.users,
            body: body
        });
    }

    async updateUser(userId: string, body: any = {}): Promise<any> {
        return this._put({
            url: this.baseUrl + this.URLs.user(userId),
            body: body,
        });
    }

    async deleteUser(userId: string): Promise<any> {
        return this._delete({
            url: this.baseUrl + this.URLs.user(userId),
        });
    }

    // **************************   Roles   **********************************
    // https://www.zoho.com/crm/developer/docs/api/v8/get-roles.html

    async listRoles(): Promise<any> {
        return this._get({
            url: this.baseUrl + this.URLs.roles
        });
    }

    async getRole(roleId: string): Promise<any> {
        return this._get({
            url: this.baseUrl + this.URLs.role(roleId)
        });
    }

    async createRole(body: any = {}): Promise<any> {
        return this._post({
            url: this.baseUrl + this.URLs.roles,
            body: body
        });
    }

    async updateRole(roleId: string, body: any = {}): Promise<any> {
        return this._put({
            url: this.baseUrl + this.URLs.role(roleId),
            body: body,
        });
    }

    async deleteRole(roleId: string, queryParams: any = {}): Promise<any> {
        return this._delete({
            url: this.baseUrl + this.URLs.role(roleId),
            query: {...queryParams},
        });
    }

    // **************************   Profiles   **********************************
    // https://www.zoho.com/crm/developer/docs/api/v8/get-profiles.html

    async listProfiles(): Promise<any> {
        return this._get({
            url: this.baseUrl + this.URLs.profiles
        });
    }

    // **************************   Contacts   **********************************
    // https://www.zoho.com/crm/developer/docs/api/v8/get-records.html

    async listContacts(queryParams: any = {}): Promise<any> {
        return this._get({
            url: this.baseUrl + this.URLs.contacts,
            query: {...queryParams},
        });
    }

    async getContact(contactId: string): Promise<any> {
        return this._get({
            url: this.baseUrl + this.URLs.contact(contactId),
        });
    }

    async searchContacts(searchParams: any = {}): Promise<any> {
        return this._get({
            url: this.baseUrl + this.URLs.contactSearch,
            query: {...searchParams},
        });
    }
}
