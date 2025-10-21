// Pipedrive-specific type definitions

// ==================== Base Types ====================

export interface OAuth2RequesterOptions {
  access_token?: string;
  refresh_token?: string;
  companyDomain?: string;
}

// ==================== Nested Object Types ====================

export interface EmailEntry {
  value: string;
  primary: boolean;
  label: string; // 'work', 'home', 'other'
}

export interface PhoneEntry {
  value: string;
  primary: boolean;
  label: string; // 'work', 'home', 'mobile', 'other'
}

export interface PostalAddress {
  value: string;
  country: string;
  admin_area_level_1: string;
  admin_area_level_2: string;
  locality: string;
  sublocality: string;
  route: string;
  street_number: string;
  postal_code: string;
}

export interface InstantMessageEntry {
  value: string;
  primary: boolean;
  label: string; // 'skype', 'whatsapp', etc.
}

export interface LocationObject {
  value: string;
  country: string;
  admin_area_level_1: string;
  admin_area_level_2: string;
  locality: string;
  sublocality: string;
  route: string;
  street_number: string;
  postal_code: string;
}

export interface ParticipantObject {
  person_id: number;
  primary: boolean;
}

export interface AttendeeObject {
  email: string;
  name: string;
  status: string;
  is_organizer: boolean;
  person_id: number;
  user_id: number;
}

export interface UserAccessObject {
  app: "global" | "sales" | "campaigns" | "projects" | "account_settings" | "partnership";
  admin: boolean;
  permission_set_id: string;
}

// ==================== Request Parameter Types ====================

export interface ListDealsParams {
  cursor?: string;
  limit?: number; // Default 100, max 500
  ids?: string; // Comma-separated IDs, max 100
  filter_id?: number;
  pipeline_id?: number;
  stage_id?: number;
  status?: 'open' | 'won' | 'lost' | 'deleted' | 'all_not_deleted';
  user_id?: number;
  org_id?: number;
  person_id?: number;
  updated_since?: string; // RFC3339 format
  updated_until?: string; // RFC3339 format
  sort_by?: 'id' | 'update_time' | 'add_time';
  sort_direction?: 'asc' | 'desc';
  include_fields?: string; // Comma-separated field names
  custom_fields?: string; // Comma-separated keys, max 15
}

export interface ListActivitiesParams {
  cursor?: string;
  limit?: number; // Default 100, max 500
  ids?: string; // Comma-separated IDs
  user_id?: number;
  filter_id?: number;
  type?: string;
  deal_id?: number;
  lead_id?: string;
  person_id?: number;
  org_id?: number;
  start_date?: string;
  end_date?: string;
  done?: boolean;
  updated_since?: string; // RFC3339 format
  updated_until?: string; // RFC3339 format
  sort_by?: 'id' | 'update_time' | 'add_time' | 'due_date';
  sort_direction?: 'asc' | 'desc';
  include_fields?: 'attendees'; // Additional fields to include
}

export interface ActivityParams {
  // Optional core fields (have defaults)
  subject?: string; // Defaults to "Call"
  type?: string; // Defaults to "Call"

  // Associations
  owner_id?: number;
  deal_id?: number; // FIXED: was dealId (camelCase)
  lead_id?: string;
  person_id?: number;
  org_id?: number;
  project_id?: number;

  // Timing
  due_date?: string;
  due_time?: string;
  duration?: string;

  // Status
  busy?: boolean;
  done?: boolean;

  // Details
  location?: LocationObject;
  participants?: ParticipantObject[];
  attendees?: AttendeeObject[];
  public_description?: string;
  priority?: number;
  note?: string;

  // Conference
  conference_meeting_client?: string;
  conference_meeting_url?: string;
  conference_meeting_id?: string;
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
    // Core
    id: number;
    name: string;
    email: string;

    // Company (only in /users/me)
    company_id: number;
    company_name: string;
    company_domain: string;
    company_country: string;
    company_industry?: string;

    // Settings
    default_currency: string;
    locale: string;
    lang: number;
    phone: string | null;
    timezone_name: string;
    timezone_offset: string;

    // Status
    activated: boolean;
    active_flag: boolean;
    is_you: boolean;
    is_deleted: boolean;
    has_created_company: boolean;

    // Dates (Format: YYYY-MM-DD HH:MM:SS)
    created: string;
    modified: string | null;
    last_login: string;

    // Permissions
    role_id: number;
    access: UserAccessObject[];

    // Optional
    icon_url: string | null;
    language?: {
      language_code: string;
      country_code: string;
    };
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

// ==================== Entity Type Definitions ====================

/**
 * Activity entity returned from Pipedrive API
 */
export interface Activity {
  id: number;
  subject: string;
  type: string;
  owner_id: number;
  creator_user_id: number;
  deal_id: number;
  lead_id: string | null;
  person_id: number;
  org_id: number;
  project_id: number | null;
  due_date: string;
  due_time: string;
  duration: string;
  busy: boolean;
  done: boolean;
  marked_as_done_time: string;
  add_time: string;
  update_time: string;
  is_deleted: boolean;
  location: LocationObject;
  participants: ParticipantObject[];
  attendees: AttendeeObject[];
  public_description: string;
  priority: number;
  note: string;
  conference_meeting_client: string;
  conference_meeting_url: string;
  conference_meeting_id: string;
}

/**
 * Deal entity returned from Pipedrive API
 */
export interface Deal {
  // Core
  id: number;
  title: string;
  value?: number;
  currency?: string;
  status?: 'open' | 'won' | 'lost';
  probability?: number;

  // Relationships
  owner_id?: number;
  person_id?: number;
  org_id?: number;
  pipeline_id?: number;
  stage_id?: number;

  // Dates
  add_time?: string;
  update_time?: string;
  close_time?: string;
  won_time?: string;
  lost_time?: string;
  expected_close_date?: string;
  archive_time?: string;

  // Status
  is_deleted?: boolean;
  is_archived?: boolean;
  lost_reason?: string;
  visible_to?: number;

  // Optional Included Fields
  next_activity_id?: number;
  last_activity_id?: number;
  first_won_time?: string;
  products_count?: number;
  files_count?: number;
  notes_count?: number;
  followers_count?: number;
  email_messages_count?: number;
  activities_count?: number;
  done_activities_count?: number;
  undone_activities_count?: number;
  participants_count?: number;
  last_incoming_mail_time?: string;
  last_outgoing_mail_time?: string;
  smart_bcc_email?: string;

  // Custom
  label_ids?: number[];
  custom_fields?: Record<string, any>;
}

/**
 * Person entity returned from Pipedrive API
 */
export interface Person {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  owner_id: number;
  org_id: number;
  add_time: string; // ISO 8601 format
  update_time: string; // ISO 8601 format
  emails: EmailEntry[];
  phones: PhoneEntry[];
  is_deleted: boolean;
  visible_to: number;
  label_ids: number[];
  picture_id: number;
  postal_address?: PostalAddress;
  notes?: string; // Max 10,000 characters
  im?: InstantMessageEntry[];
  birthday?: string;
  job_title?: string;
  custom_fields?: Record<string, any>;
}
