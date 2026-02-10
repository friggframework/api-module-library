import FormData = require('form-data');
import {OAuth2Requester, get} from '@friggframework/core';
import {
    ZohoConfig,
    ZohoLocation,
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
    ZohoNote,
    CreateNoteData,
    NotesResponse,
    NoteListResponse,
    NotificationWatchConfig,
    NotificationResponse,
    NotificationDetailsResponse,
    ZohoCallData,
    CallsResponse,
} from './types';

/**
 * Zoho datacenter URL configuration
 * @see https://www.zoho.com/crm/developer/docs/api/v8/multi-dc.html
 */
const LOCATION_CONFIG: Record<ZohoLocation, { accounts: string; api: string }> = {
    us: { accounts: 'https://accounts.zoho.com', api: 'https://www.zohoapis.com' },
    eu: { accounts: 'https://accounts.zoho.eu', api: 'https://www.zohoapis.eu' },
    in: { accounts: 'https://accounts.zoho.in', api: 'https://www.zohoapis.in' },
    au: { accounts: 'https://accounts.zoho.com.au', api: 'https://www.zohoapis.com.au' },
    cn: { accounts: 'https://accounts.zoho.com.cn', api: 'https://www.zohoapis.com.cn' },
    ca: { accounts: 'https://accounts.zohocloud.ca', api: 'https://www.zohoapis.ca' },
    jp: { accounts: 'https://accounts.zoho.jp', api: 'https://www.zohoapis.jp' },
    sa: { accounts: 'https://accounts.zoho.sa', api: 'https://www.zohoapis.sa' },
};

const DEFAULT_LOCATION: ZohoLocation = 'us';

/**
 * Formats datetime for Zoho API (removes milliseconds, converts Z to +00:00)
 * Zoho expects format: 2019-05-02T15:00:00+05:30
 */
function formatDateTimeForZoho(dateStr: string | undefined): string | undefined {
    if (!dateStr) return dateStr;
    return dateStr.replace(/\.\d{3}Z$/, '+00:00').replace(/Z$/, '+00:00');
}

export class Api extends OAuth2Requester {
    public URLs: Record<string, string | ((id: string) => string)>;
    public location: ZohoLocation;

    private static readonly CONTACTS_DEFAULT_FIELDS = 'id,First_Name,Last_Name,Email,Phone,Mobile,Account_Name,Company,Owner,Lead_Source,Created_Time,Modified_Time';
    private static readonly LEADS_DEFAULT_FIELDS = 'id,First_Name,Last_Name,Email,Phone,Mobile,Company,Industry,Lead_Source,Lead_Status,Owner,Created_Time,Modified_Time,Converted__s,Converted_Date_Time';
    private static readonly ACCOUNTS_DEFAULT_FIELDS = 'id,Account_Name,Account_Number,Account_Type,Industry,Annual_Revenue,Rating,Phone,Fax,Website,Parent_Account,Owner,Billing_City,Billing_State,Billing_Country,Shipping_City,Shipping_State,Shipping_Country,Created_Time,Modified_Time';

    constructor(params: ZohoConfig) {
        super(params);

        this.location = get(params, 'location', DEFAULT_LOCATION) as ZohoLocation;
        if (!LOCATION_CONFIG[this.location]) {
            this.location = DEFAULT_LOCATION;
        }
        const locationConfig = LOCATION_CONFIG[this.location];

        this.baseUrl = `${locationConfig.api}/crm/v8`;
        this.tokenUri = `${locationConfig.accounts}/oauth/v2/token`;
        this.authorizationUri = encodeURI(
            `${locationConfig.accounts}/oauth/v2/auth?scope=${this.scope}&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&access_type=offline&prompt=consent`
        );
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
            calls: '/Calls',
            call: (callId: string) => `/Calls/${callId}`,
            notificationsWatch: '/actions/watch',
        };
    }

    getAuthUri(): string {
        return this.authorizationUri;
    }

    setLocation(location: ZohoLocation): void {
        if (!LOCATION_CONFIG[location]) {
            throw new Error(
                `Invalid Zoho location: ${location}. Must be one of: ${Object.keys(LOCATION_CONFIG).join(', ')}`
            );
        }

        this.location = location;
        const locationConfig = LOCATION_CONFIG[location];
        this.baseUrl = `${locationConfig.api}/crm/v8`;
        this.tokenUri = `${locationConfig.accounts}/oauth/v2/token`;
        this.authorizationUri = encodeURI(
            `${locationConfig.accounts}/oauth/v2/auth?scope=${this.scope}&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&access_type=offline&prompt=consent`
        );
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

    /**
     * Build URL for notes endpoints with proper encoding
     * @param module - Module API name (e.g., 'Contacts', 'Leads')
     * @param recordId - Record ID
     * @param noteId - Optional note ID for specific note operations
     * @returns Encoded URL path for notes endpoint
     */
    private buildNotesUrl(module: string, recordId: string, noteId?: string): string {
        const segments = [module, recordId, 'Notes'];
        if (noteId) segments.push(noteId);

        const encodedPath = segments.map(encodeURIComponent).join('/');
        return `${this.baseUrl}/${encodedPath}`;
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
        } catch (error: any) {
            // Zoho returns 204 No Content with empty body when no results found
            // This causes JSON parsing to fail with "Unexpected end of JSON input"
            if (error?.message?.includes('Unexpected end of JSON input') ||
                error?.message?.includes('invalid json response body')) {
                return { data: [], info: undefined };
            }
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
        } catch (error: any) {
            // Zoho returns 204 No Content with empty body when no results found
            if (error?.message?.includes('Unexpected end of JSON input') ||
                error?.message?.includes('invalid json response body')) {
                return { data: [], info: undefined };
            }
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
        } catch (error: any) {
            // Zoho returns 204 No Content with empty body when no results found
            if (error?.message?.includes('Unexpected end of JSON input') ||
                error?.message?.includes('invalid json response body')) {
                return { data: [], info: undefined };
            }
            throw error;
        }
    }

    /**
     * List all notes for a specific record
     * @param module - Module API name (Contacts, Leads, Accounts, etc.)
     * @param recordId - Record ID to get notes for
     * @param queryParams - Optional query parameters (per_page, page, etc.)
     * @returns Promise<NoteListResponse> Notes list response
     */
    async listNotes(module: string, recordId: string, queryParams: QueryParams = {}): Promise<NoteListResponse> {
        if (!module) {
            throw new Error('module is required');
        }
        if (!recordId) {
            throw new Error('recordId is required');
        }
        try {
            return await this._get({
                url: this.buildNotesUrl(module, recordId),
                query: queryParams,
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get a specific note by ID
     * @param module - Module API name (Contacts, Leads, Accounts, etc.)
     * @param recordId - Record ID the note is attached to
     * @param noteId - Note ID to retrieve
     * @returns Promise<NotesResponse> Note details
     */
    async getNote(module: string, recordId: string, noteId: string): Promise<NotesResponse> {
        if (!module) {
            throw new Error('module is required');
        }
        if (!recordId) {
            throw new Error('recordId is required');
        }
        if (!noteId) {
            throw new Error('noteId is required');
        }
        try {
            return await this._get({
                url: this.buildNotesUrl(module, recordId, noteId),
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Create a note for a specific record
     * @param module - Module API name (Contacts, Leads, Accounts, etc.)
     * @param recordId - Record ID to attach note to
     * @param noteData - Note data with Note_Content (required) and optional Note_Title
     * @returns Promise<NotesResponse> Created note response
     */
    async createNote(module: string, recordId: string, noteData: CreateNoteData): Promise<NotesResponse> {
        if (!module) {
            throw new Error('module is required');
        }
        if (!recordId) {
            throw new Error('recordId is required');
        }
        if (!noteData || !noteData.Note_Content) {
            throw new Error('noteData.Note_Content is required');
        }

        const body = {
            data: [{
                Note_Content: noteData.Note_Content,
                ...(noteData.Note_Title && { Note_Title: noteData.Note_Title }),
            }]
        };

        try {
            return await this._post({
                url: this.buildNotesUrl(module, recordId),
                body: body,
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update an existing note
     * @param module - Module API name (Contacts, Leads, Accounts, etc.)
     * @param recordId - Record ID the note is attached to
     * @param noteId - Note ID to update
     * @param noteData - Updated note data. At least one of Note_Content or Note_Title must be provided.
     * @returns Promise<NotesResponse> Updated note response
     */
    async updateNote(module: string, recordId: string, noteId: string, noteData: Partial<CreateNoteData>): Promise<NotesResponse> {
        if (!module) {
            throw new Error('module is required');
        }
        if (!recordId) {
            throw new Error('recordId is required');
        }
        if (!noteId) {
            throw new Error('noteId is required');
        }
        if (!noteData || (!noteData.Note_Content && !noteData.Note_Title)) {
            throw new Error('noteData must contain Note_Content or Note_Title');
        }

        const body = {
            data: [{
                ...(noteData.Note_Content && { Note_Content: noteData.Note_Content }),
                ...(noteData.Note_Title && { Note_Title: noteData.Note_Title }),
            }]
        };

        try {
            return await this._put({
                url: this.buildNotesUrl(module, recordId, noteId),
                body: body,
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Delete a note
     * @param module - Module API name (Contacts, Leads, Accounts, etc.)
     * @param recordId - Record ID the note is attached to
     * @param noteId - Note ID to delete
     * @returns Promise<NotesResponse> Deletion response
     */
    async deleteNote(module: string, recordId: string, noteId: string): Promise<NotesResponse> {
        if (!module) {
            throw new Error('module is required');
        }
        if (!recordId) {
            throw new Error('recordId is required');
        }
        if (!noteId) {
            throw new Error('noteId is required');
        }
        try {
            return await this._delete({
                url: this.buildNotesUrl(module, recordId, noteId),
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Enable notification channel to receive real-time events
     * @param body - Notification configuration with watch items
     * @returns Promise<NotificationResponse> Response with channel details
     * @see https://www.zoho.com/crm/developer/docs/api/v8/notifications/enable.html
     */
    async enableNotification(body: NotificationWatchConfig): Promise<NotificationResponse> {
        if (!body || !body.watch || !Array.isArray(body.watch)) {
            throw new Error('Body must contain watch array');
        }

        // Validate each watch item
        body.watch.forEach((item, index) => {
            if (!item.channel_id) {
                throw new Error(`watch[${index}].channel_id is required`);
            }
            if (!item.events || !Array.isArray(item.events) || item.events.length === 0) {
                throw new Error(`watch[${index}].events must be a non-empty array`);
            }
            if (!item.notify_url) {
                throw new Error(`watch[${index}].notify_url is required`);
            }
            if (item.token && item.token.length > 50) {
                throw new Error(`watch[${index}].token must be 50 characters or less`);
            }
        });

        const formattedBody: NotificationWatchConfig = {
            ...body,
            watch: body.watch.map(item => ({
                ...item,
                ...(item.channel_expiry && { channel_expiry: formatDateTimeForZoho(item.channel_expiry) })
            }))
        };

        try {
            return await this._post({
                url: this.baseUrl + this.URLs.notificationsWatch,
                body: formattedBody,
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update/renew notification channel configuration
     * Use this to extend the channel_expiry before it expires (max 7 days from now)
     * @param body - Notification configuration with watch items to update
     * @returns Promise<NotificationResponse> Response with updated channel details
     * @see https://www.zoho.com/crm/developer/docs/api/v8/notifications/update.html
     */
    async updateNotification(body: NotificationWatchConfig): Promise<NotificationResponse> {
        if (!body || !body.watch || !Array.isArray(body.watch)) {
            throw new Error('Body must contain watch array');
        }

        // Validate each watch item
        body.watch.forEach((item, index) => {
            if (!item.channel_id) {
                throw new Error(`watch[${index}].channel_id is required`);
            }
            if (!item.events || !Array.isArray(item.events) || item.events.length === 0) {
                throw new Error(`watch[${index}].events must be a non-empty array`);
            }
            if (!item.notify_url) {
                throw new Error(`watch[${index}].notify_url is required`);
            }
            if (item.token && item.token.length > 50) {
                throw new Error(`watch[${index}].token must be 50 characters or less`);
            }
        });

        const formattedBody: NotificationWatchConfig = {
            ...body,
            watch: body.watch.map(item => ({
                ...item,
                ...(item.channel_expiry && { channel_expiry: formatDateTimeForZoho(item.channel_expiry) })
            }))
        };

        try {
            return await this._patch({
                url: this.baseUrl + this.URLs.notificationsWatch,
                body: formattedBody,
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Disable notification channels
     * @param channelIds - Array of channel IDs to disable
     * @returns Promise<NotificationResponse> Response confirming deletion
     * @see https://www.zoho.com/crm/developer/docs/api/v8/notifications/disable.html
     */
    async disableNotification(channelIds: Array<string | number>): Promise<NotificationResponse> {
        if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
            throw new Error('channelIds must be a non-empty array');
        }

        try {
            return await this._delete({
                url: this.baseUrl + this.URLs.notificationsWatch,
                query: {
                    channel_ids: channelIds.join(',')
                },
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get details of all active notification channels
     * @returns Promise<NotificationDetailsResponse> Details of all active channels
     * @see https://www.zoho.com/crm/developer/docs/api/v8/notifications/get-details.html
     */
    async getNotificationDetails(): Promise<NotificationDetailsResponse> {
        try {
            return await this._get({
                url: this.baseUrl + this.URLs.notificationsWatch,
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Log a call in Zoho CRM Calls module
     * @param callData - Call record data with Subject, Call_Type, Call_Start_Time, Call_Duration
     * @returns Promise<CallsResponse> Created call response
     * @see https://www.zoho.com/crm/developer/docs/api/v8/insert-records.html
     */
    async logCall(callData: ZohoCallData): Promise<CallsResponse> {
        if (!callData.Subject) {
            throw new Error('callData.Subject is required');
        }
        if (!callData.Call_Type) {
            throw new Error('callData.Call_Type is required');
        }
        if (!callData.Call_Start_Time) {
            throw new Error('callData.Call_Start_Time is required');
        }

        // Duration is mandatory for Inbound/Outbound calls and cannot be zero
        if ((callData.Call_Type === 'Inbound' || callData.Call_Type === 'Outbound') && !callData.Call_Duration) {
            throw new Error('callData.Call_Duration is required for Inbound/Outbound calls');
        }

        const body = {
            data: [callData]
        };

        try {
            return await this._post({
                url: this.baseUrl + this.URLs.calls,
                body: body,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update an existing call record in Zoho CRM Calls module
     * @param callId - Zoho Call ID to update
     * @param callData - Partial call data to update (e.g., Description, Subject)
     * @returns Promise<CallsResponse> Updated call response
     * @see https://www.zoho.com/crm/developer/docs/api/v8/update-records.html
     */
    async updateCall(callId: string, callData: Partial<ZohoCallData>): Promise<CallsResponse> {
        if (!callId) {
            throw new Error('callId is required');
        }
        if (!callData || Object.keys(callData).length === 0) {
            throw new Error('callData must contain at least one field to update');
        }

        const body = {
            data: [callData]
        };

        try {
            return await this._put({
                url: this.baseUrl + (this.URLs.call as (id: string) => string)(callId),
                body: body,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        } catch (error) {
            throw error;
        }
    }
}
