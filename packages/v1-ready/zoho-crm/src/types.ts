export interface ZohoConfig {
    client_id: string;
    client_secret: string;
    scope: string;
    redirect_uri: string;
    access_token?: string | null;
    refresh_token?: string | null;
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

export interface WebhookConfig {
    module: string;
    name: string;
    url: string;
    http_method: 'POST' | 'GET';
    description?: string;
    authentication?: {
        type: 'general';
        authorization_type: 'bearer' | 'basic';
        authorization_key: string;
    };
    module_params?: Array<{
        name: string;
        value: string;
    }>;
    custom_params?: Array<{
        name: string;
        value: string;
    }>;
}

export interface WebhookResponse {
    webhooks: Array<{
        code: string;
        details: {
            id: string;
        };
        message: string;
        status: string;
    }>;
}
