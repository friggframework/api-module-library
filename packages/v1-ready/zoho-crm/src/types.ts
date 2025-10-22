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
