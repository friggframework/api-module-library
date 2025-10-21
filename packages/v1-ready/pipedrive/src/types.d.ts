// Pipedrive-specific type definitions

export interface OAuth2RequesterOptions {
  access_token?: string;
  refresh_token?: string;
  companyDomain?: string;
}

export interface ListDealsParams {
  cursor?: string;
  limit?: number;
  filter_id?: number;
  stage_id?: number;
  status?: 'open' | 'won' | 'lost' | 'deleted' | 'all_not_deleted';
  user_id?: number;
  org_id?: number;
  person_id?: number;
}

export interface ListActivitiesParams {
  cursor?: string;
  limit?: number;
  user_id?: number;
  filter_id?: number;
  type?: string;
  start_date?: string;
  end_date?: string;
  done?: boolean;
}

export interface ActivityParams {
  dealId?: string | number | null;
  subject: string;
  type: string;
  due_date?: Date | string;
  user_id?: string | number;
  person_id?: number;
  org_id?: number;
  note?: string;
  done?: boolean;
}

export interface ListPersonsParams {
  cursor?: string;
  limit?: number;
  filter_id?: number;
  owner_id?: number;
  org_id?: number;
  updated_since?: string;
  updated_until?: string;
  sort_by?: 'id' | 'update_time' | 'add_time';
  sort_direction?: 'asc' | 'desc';
  include_fields?: string;
  custom_fields?: string;
}

export interface GetPersonParams {
  include_fields?: string;
  custom_fields?: string;
}

export interface PipedriveUser {
  data: {
    id: number;
    name: string;
    company_id: number;
    company_name: string;
    company_domain: string;
    company_country: string;
    email: string;
    phone: string;
    [key: string]: any;
  };
  success: boolean;
}

export interface PipedriveResponse<T = any> {
  success: boolean;
  data: T;
  additional_data?: {
    next_cursor?: string;
    pagination?: {
      start: number;
      limit: number;
      more_items_in_collection: boolean;
    };
  };
}

export interface PipedriveTokenResponse {
  access_token: string;
  refresh_token: string;
  api_domain: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}
