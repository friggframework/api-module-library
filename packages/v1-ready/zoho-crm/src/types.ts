/**
 * Zoho datacenter locations
 * @see https://www.zoho.com/crm/developer/docs/api/v8/multi-dc.html
 */
export type ZohoLocation = 'us' | 'eu' | 'in' | 'au' | 'cn' | 'ca' | 'jp' | 'sa';

export interface ZohoConfig {
    client_id: string;
    client_secret: string;
    scope: string;
    redirect_uri: string;
    access_token?: string | null;
    refresh_token?: string | null;
    location?: ZohoLocation;
}

export interface PaginationInfo {
    per_page: number;
    count: number;
    page: number;
    more_records: boolean;
    next_page_token?: string;
}

export interface ZohoUser {
    id: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    email: string;
    role?: {
        name: string;
        id: string;
    };
    profile?: {
        name: string;
        id: string;
    };
    status?: string;
}

export interface ZohoRole {
    id: string;
    name: string;
    description?: string;
}

export interface ZohoProfile {
    id: string;
    name: string;
    description?: string;
}

export interface ZohoContact {
    id: string;
    First_Name?: string;
    Last_Name?: string;
    Email?: string;
    Phone?: string;
    Account_Name?: {
        name: string;
        id: string;
    };
    Owner?: {
        name: string;
        id: string;
    };
    Lead_Source?: string;
    Created_Time?: string;
    Modified_Time?: string;
    [key: string]: any; // Allow custom fields
}

export interface ZohoLead {
    id: string;
    First_Name?: string;
    Last_Name?: string;
    Email?: string;
    Phone?: string;
    Mobile?: string;
    Company?: string;
    Industry?: string;
    Lead_Source?: string;
    Lead_Status?: string;
    Owner?: {
        name: string;
        id: string;
    };
    Converted__s?: boolean;
    Converted_Date_Time?: string;
    Created_Time?: string;
    Modified_Time?: string;
    [key: string]: any; // Allow custom fields
}

export interface ZohoAccount {
    id: string;
    Account_Name?: string;
    Account_Number?: string;
    Account_Type?: string;
    Industry?: string;
    Annual_Revenue?: number;
    Rating?: string;
    Phone?: string;
    Fax?: string;
    Website?: string;
    Ticker_Symbol?: string;
    Ownership?: string;
    Employees?: number;
    SIC_Code?: string;
    Billing_Street?: string;
    Billing_City?: string;
    Billing_State?: string;
    Billing_Code?: string;
    Billing_Country?: string;
    Shipping_Street?: string;
    Shipping_City?: string;
    Shipping_State?: string;
    Shipping_Code?: string;
    Shipping_Country?: string;
    Parent_Account?: {
        name: string;
        id: string;
    };
    Owner?: {
        name: string;
        id: string;
    };
    Description?: string;
    Created_Time?: string;
    Modified_Time?: string;
    Created_By?: {
        name: string;
        id: string;
    };
    Modified_By?: {
        name: string;
        id: string;
    };
    [key: string]: any;
}

export interface UsersResponse {
    users: ZohoUser[];
    info?: PaginationInfo;
}

export interface RolesResponse {
    roles: ZohoRole[];
}

export interface ProfilesResponse {
    profiles: ZohoProfile[];
}

export interface ContactsResponse {
    data: ZohoContact[];
    info?: PaginationInfo;
}

export interface ContactResponse {
    data: ZohoContact[];
}

export interface LeadsResponse {
    data: ZohoLead[];
    info?: PaginationInfo;
}

export interface LeadResponse {
    data: ZohoLead[];
}

export interface AccountsResponse {
    data: ZohoAccount[];
    info?: PaginationInfo;
}

export interface AccountResponse {
    data: ZohoAccount[];
}

export interface CreateResponse {
    code: string;
    details: {
        id: string;
        Created_Time: string;
        Modified_Time: string;
        Created_By?: {
            name: string;
            id: string;
        };
        Modified_By?: {
            name: string;
            id: string;
        };
    };
    message: string;
    status: string;
}

export interface UpdateResponse {
    code: string;
    details: {
        id: string;
        Modified_Time: string;
        Modified_By?: {
            name: string;
            id: string;
        };
    };
    message: string;
    status: string;
}

export interface DeleteResponse {
    code: string;
    details: {
        id: string;
    };
    message: string;
    status: string;
}

export interface ZohoNote {
    id: string;
    Note_Title?: string;
    Note_Content: string;
    Parent_Id?: {
        module: {
            api_name: string;
            id: string;
        };
        id: string;
    };
    Owner?: {
        name: string;
        id: string;
    };
    Created_Time?: string;
    Modified_Time?: string;
    Created_By?: {
        name: string;
        id: string;
    };
    Modified_By?: {
        name: string;
        id: string;
    };
    [key: string]: any;
}

export interface CreateNoteData {
    Note_Content: string;
    Note_Title?: string;
}

export interface NotesResponse {
    data: Array<{
        code: string;
        details: {
            id: string;
            Created_Time: string;
            Modified_Time: string;
            Created_By?: {
                name: string;
                id: string;
            };
            Modified_By?: {
                name: string;
                id: string;
            };
        };
        message: string;
        status: string;
    }>;
}

export interface NoteListResponse {
    data: ZohoNote[];
    info?: PaginationInfo;
}

export interface QueryParams {
    fields?: string;
    per_page?: number;
    page?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    cvid?: string;
    page_token?: string;
    type?: 'ActiveUsers' | 'CurrentUser' | 'AdminUsers' | 'AllUsers';
}

export interface SearchParams {
    email?: string;
    phone?: string;
    criteria?: string;
    word?: string;
    fields?: string;
    per_page?: number;
}

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    api_domain: string;
    token_type: string;
    expires_in: number;
}

/**
 * Configuration for a single notification watch item
 */
export interface NotificationWatchItem {
    /** Unique channel ID (use timestamp or UUID) */
    channel_id: number | string;
    /** Events to watch in format: "Module.operation" (e.g., "Contacts.all", "Contacts.create", "Accounts.edit") */
    events: string[];
    /** Callback URL to receive notifications */
    notify_url: string;
    /** Optional verification token (max 50 characters) */
    token?: string;
    /** Channel expiry time (ISO 8601 format, max 1 week from now) */
    channel_expiry?: string;
    /** Include field changes in callback payload */
    return_affected_field_values?: boolean;
    /** Trigger notifications on related record actions */
    notify_on_related_action?: boolean;
}

/**
 * Request body for enabling notifications
 */
export interface NotificationWatchConfig {
    watch: NotificationWatchItem[];
}

/**
 * Response from notification API operations
 */
export interface NotificationResponse {
    watch: Array<{
        code: string;
        details: {
            channel_id: number | string;
            events: string[];
            channel_expiry: string;
            resource_uri: string;
            resource_id: string;
            resource_name: string;
        };
        message: string;
        status: string;
    }>;
}

/**
 * Response from getting notification details
 */
export interface NotificationDetailsResponse {
    watch: Array<{
        channel_id: number | string;
        events: string[];
        channel_expiry: string;
        notify_url: string;
        resource_uri: string;
        resource_id: string;
        resource_name: string;
        token?: string;
    }>;
}

/**
 * Payload received in notification callback
 */
export interface NotificationCallbackPayload {
    /** Server timestamp */
    server_time: number;
    /** Module name (e.g., "Contacts", "Accounts") */
    module: string;
    /** Resource URI */
    resource_uri: string;
    /** Array of affected record IDs */
    ids: string[];
    /** Fields that were affected (if return_affected_field_values enabled) */
    affected_fields?: string[];
    /** Operation type: "insert", "update", or "delete" */
    operation: 'insert' | 'update' | 'delete';
    /** Channel ID that triggered this notification */
    channel_id: number | string;
    /** Verification token (if provided during setup) */
    token?: string;
}

/**
 * Data for creating/updating a call record in Zoho CRM Calls module
 */
export interface ZohoCallData {
    /** Call subject/title (required) */
    Subject: string;
    /** Call type: Inbound, Outbound, or Missed (required) */
    Call_Type: 'Inbound' | 'Outbound' | 'Missed';
    /** Call start time in ISO 8601 format (required) */
    Call_Start_Time: string;
    /** Call duration in "HH:mm" or "mm:ss" format (required for Inbound/Outbound, cannot be zero) */
    Call_Duration: string;
    /** Call notes/description */
    Description?: string;
    /** Contact or Lead ID to associate the call with */
    Who_Id?: string;
    /** Module name for the Who_Id association: "Contacts" or "Leads" */
    $se_module?: string;
    /** Additional custom fields */
    [key: string]: any;
}

export interface ZohoOrg {
    id: string;
    company_name: string;
    domain_name: string;
    time_zone: string;
    currency: string;
    [key: string]: any;
}

export interface OrgResponse {
    org: ZohoOrg[];
}

/**
 * Response from Calls module operations
 */
export interface CallsResponse {
    data: Array<{
        code: string;
        details: {
            id: string;
            Created_Time: string;
            Modified_Time: string;
            Created_By?: {
                name: string;
                id: string;
            };
            Modified_By?: {
                name: string;
                id: string;
            };
        };
        message: string;
        status: string;
    }>;
}
