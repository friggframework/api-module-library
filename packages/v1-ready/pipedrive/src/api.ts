import { get, OAuth2Requester, RequestOptions } from "@friggframework/core";
import {
  OAuth2RequesterOptions,
  ActivityParams,
  ListActivitiesParams,
  ListDealsParams,
  CreateDealParams,
  ListPersonsParams,
  GetPersonParams,
  SearchPersonsParams,
  SearchParams,
  CreateNoteParams,
  ListOrganizationsParams,
  GetOrganizationParams,
  PipedriveResponse,
  PipedriveUser,
  PipedriveTokenResponse,
  CreateWebhookParams,
  CreateCallLogParams,
  UpdateCallLogParams,
  ListCallLogsParams,
  ListLeadsParams,
} from "./types";

export class Api extends OAuth2Requester {
  companyDomain: string | null;
  URLs: {
    activities: string;
    activityFields: string;
    activityById: (activityId: string | number) => string;
    getUser: string;
    users: string;
    usersFind: string;
    deals: string;
    persons: string;
    personById: (personId: string | number) => string;
    personsSearch: string;
    organizations: string;
    organizationById: (orgId: string | number) => string;
    notes: string;
    webhooks: string;
    webhookById: (webhookId: string | number) => string;
    search: string;
    callLogs: string;
    callLogById: (callLogId: string) => string;
    leads: string;
    leadById: (leadId: string) => string;
  };

  constructor(params: OAuth2RequesterOptions) {
    super(params);

    this.companyDomain = get(params, "companyDomain", null);

    this.baseUrl = `${this.companyDomain}/api`;

    this.URLs = {
      activities: "/v2/activities",
      activityFields: "/v1/activityFields",
      activityById: (activityId: string | number) =>
        `/v2/activities/${activityId}`,
      getUser: "/v1/users/me",
      users: "/v1/users",
      usersFind: "/v1/users/find",
      deals: "/v2/deals",
      persons: "/v2/persons",
      personById: (personId: string | number) => `/v2/persons/${personId}`,
      personsSearch: "/v2/persons/search",
      organizations: "/v2/organizations",
      organizationById: (orgId: string | number) => `/v2/organizations/${orgId}`,
      notes: "/v1/notes",
      webhooks: "/v1/webhooks",
      webhookById: (webhookId: string | number) => `/v1/webhooks/${webhookId}`,
      search: "/v1/search",
      callLogs: "/v1/callLogs",
      callLogById: (callLogId: string) => `/v1/callLogs/${callLogId}`,
      leads: "/v1/leads",
      leadById: (leadId: string) => `/v1/leads/${leadId}`,
    };

    this.authorizationUri = encodeURI(
      `https://oauth.pipedrive.com/oauth/authorize?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&scope=${this.scope}`
    );

    this.tokenUri = "https://oauth.pipedrive.com/oauth/token";
  }

  /**
   * Sets OAuth tokens and captures the Pipedrive company domain
   * @param params - Token response from OAuth provider
   * @param params.api_domain - The Pipedrive company-specific API domain (e.g., 'https://company.pipedrive.com')
   * @returns Token response
   */
  async setTokens(
    params: PipedriveTokenResponse
  ): Promise<PipedriveTokenResponse> {
    if (params.api_domain) {
      await this.setCompanyDomain(params.api_domain);
    } else if (!this.companyDomain) {
      throw new Error("Pipedrive api_domain not provided in token response");
    }
    return super.setTokens(params);
  }

  /**
   * Sets the company domain and updates the base URL for API requests
   * @param companyDomain - The Pipedrive company domain (e.g., 'https://company.pipedrive.com' or 'company.pipedrive.com')
   */
  async setCompanyDomain(companyDomain: string): Promise<void> {
    if (!companyDomain) {
      throw new Error("Company domain is required for Pipedrive API");
    }

    const formattedDomain = companyDomain.startsWith("http")
      ? companyDomain
      : `https://${companyDomain}`;

    this.companyDomain = formattedDomain;
    this.baseUrl = `${this.companyDomain}/api`;
  }

  // **************************   Deals   **********************************
  /**
   * List deals with v2 API support
   * @param params - Query parameters for filtering and pagination
   * @returns Response with deal data array and pagination cursor
   */
  async listDeals(params?: ListDealsParams): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.deals,
    };
    if (params && Object.keys(params).length > 0) {
      options.query = params;
    }
    return this._get(options);
  }

  /**
   * Create a new deal
   * @param params - Deal data
   * @param params.title - Deal title (required)
   * @param params.value - Deal value
   * @param params.currency - Currency code
   * @param params.person_id - Associated person ID
   * @param params.org_id - Associated organization ID
   * @param params.pipeline_id - Pipeline ID
   * @param params.stage_id - Stage ID
   * @returns Response with created deal data
   */
  async createDeal(params: CreateDealParams): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.deals,
      body: params,
      headers: {
        "Content-Type": "application/json",
      },
    };
    return this._post(options);
  }

  // **************************   Activities   **********************************
  async listActivityFields(): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.activityFields,
    };
    return this._get(options);
  }

  /**
   * List activities with v2 API support
   * @param params - Query parameters for filtering and pagination
   * @returns Response with activity data array and pagination cursor
   */
  async listActivities(
    params?: ListActivitiesParams
  ): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.activities,
    };
    if (params && Object.keys(params).length > 0) {
      options.query = params;
    }
    return this._get(options);
  }

  async deleteActivity(
    activityId: string | number
  ): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.activityById(activityId),
    };
    return this._delete(options);
  }

  async updateActivity(
    activityId: string | number,
    task: Partial<ActivityParams>
  ): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.activityById(activityId),
      body: task,
      headers: {
        "Content-Type": "application/json",
      },
    };
    return this._patch(options);
  }

  async createActivity(params: ActivityParams): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.activities,
      body: { ...params },
      headers: {
        "Content-Type": "application/json",
      },
    };
    return this._post(options);
  }

  // **************************   Users   **********************************
  async getUser(): Promise<PipedriveUser> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.getUser,
    };
    return this._get(options);
  }

  async listUsers(): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.users,
    };
    return this._get(options);
  }

  async findUsers(params: { term: string; search_by_email?: 0 | 1 }): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.usersFind,
      query: params,
    };
    return this._get(options);
  }

  // **************************   Persons   **********************************
  /**
   * List persons with v2 API support
   * @param params - Query parameters for filtering and pagination
   * @returns Response with person data array and pagination cursor
   */
  async listPersons(params?: ListPersonsParams): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.persons,
    };
    if (params && Object.keys(params).length > 0) {
      options.query = params;
    }
    return this._get(options);
  }

  /**
   * Get a single person by ID
   * @param personId - The ID of the person to retrieve
   * @param params - Query parameters for additional fields
   * @returns Response with person data
   */
  async getPerson(
    personId: string | number,
    params?: GetPersonParams
  ): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.personById(personId),
    };
    if (params && Object.keys(params).length > 0) {
      options.query = params;
    }
    return this._get(options);
  }

  /**
   * Search for persons
   * @param params - Search parameters
   * @param params.term - The search term (minimum 2 characters, or 1 if using exact_match)
   * @param params.fields - Comma-separated fields to search in
   * @param params.exact_match - When enabled, only full exact matches are returned
   * @param params.organization_id - Filter persons by organization ID
   * @param params.include_fields - Optional fields to include (e.g., "person.picture")
   * @param params.limit - Number of entries to return (default 100, max 500)
   * @param params.cursor - Pagination cursor
   * @returns Response with search results including items with result_score and person data
   */
  async searchPersons(params: SearchPersonsParams): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.personsSearch,
      query: params,
    };
    return this._get(options);
  }

  /**
   * Search across all items (persons, organizations, deals, etc.)
   * @param params - Search parameters
   * @param params.term - The search term (minimum 2 characters)
   * @param params.item_types - Comma-separated item types to search (e.g., 'person,organization,deal')
   * @param params.exact_match - When enabled, only full exact matches are returned
   * @param params.fields - Comma-separated fields to search in
   * @param params.limit - Number of entries to return (default 10, max 100)
   * @param params.start - Pagination start
   * @returns Response with search results across multiple item types
   */
  async search(params: SearchParams): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.search,
      query: params,
    };
    return this._get(options);
  }

  // **************************   Notes   **********************************
  /**
   * Create a new note
   * @param params - Note data
   * @param params.content - The content of the note in HTML format (required)
   * @param params.lead_id - The ID of the lead (UUID format)
   * @param params.deal_id - The ID of the deal
   * @param params.person_id - The ID of the person
   * @param params.org_id - The ID of the organization
   * @param params.project_id - The ID of the project
   * @param params.user_id - The ID of the user (author)
   * @param params.add_time - Creation date & time in UTC (Format: YYYY-MM-DD HH:MM:SS)
   * @returns Response with created note data
   */
  async createNote(params: CreateNoteParams): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.notes,
      body: params,
      headers: {
        "Content-Type": "application/json",
      },
    };
    return this._post(options);
  }

  // **************************   Organizations   **********************************
  /**
   * List organizations with v2 API support
   * @param params - Query parameters for filtering and pagination
   * @returns Response with organization data array and pagination cursor
   */
  async listOrganizations(
    params?: ListOrganizationsParams
  ): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.organizations,
    };
    if (params && Object.keys(params).length > 0) {
      options.query = params;
    }
    return this._get(options);
  }

  /**
   * Get a single organization by ID
   * @param orgId - The ID of the organization to retrieve
   * @param params - Query parameters for additional fields
   * @returns Response with organization data
   */
  async getOrganization(
    orgId: string | number,
    params?: GetOrganizationParams
  ): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.organizationById(orgId),
    };
    if (params && Object.keys(params).length > 0) {
      options.query = params;
    }
    return this._get(options);
  }

  // **************************   Webhooks   **********************************
  /**
   * List all webhooks for the company
   * @returns Response with array of webhook configurations
   */
  async listWebhooks(): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.webhooks,
    };
    return this._get(options);
  }

  /**
   * Create a new webhook subscription
   * @param params - Webhook configuration
   * @param params.subscription_url - Public HTTPS URL to receive webhooks
   * @param params.event_action - Event action: added, updated, deleted, merged, *
   * @param params.event_object - Event object: person, organization, deal, activity, product, *
   * @param params.name - Human-readable name for the webhook
   * @param params.user_id - Optional: User ID to authorize webhook with
   * @param params.http_auth_user - Optional: HTTP basic auth username
   * @param params.http_auth_password - Optional: HTTP basic auth password
   * @param params.version - Optional: Webhook version (1.0 or 2.0, default: 2.0)
   * @returns Response with created webhook data
   */
  async createWebhook(params: CreateWebhookParams): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.webhooks,
      body: params,
      headers: {
        "Content-Type": "application/json",
      },
    };
    return this._post(options);
  }

  /**
   * Delete a webhook by ID
   * @param webhookId - The ID of the webhook to delete
   * @returns Response confirming deletion
   */
  async deleteWebhook(
    webhookId: string | number
  ): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.webhookById(webhookId),
    };
    return this._delete(options);
  }

  // **************************   Call Logs   **********************************

  /**
   * List all call logs
   * @param params - Pagination parameters
   * @param params.start - Pagination start position (default: 0)
   * @param params.limit - Max entries per page (max: 50)
   * @returns Response with call log data array
   */
  async listCallLogs(params?: ListCallLogsParams): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.callLogs,
    };
    if (params && Object.keys(params).length > 0) {
      options.query = params;
    }
    return this._get(options);
  }

  /**
   * Get a single call log by ID
   * @param callLogId - The ID of the call log to retrieve
   * @returns Response with call log data
   */
  async getCallLog(callLogId: string): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.callLogById(callLogId),
    };
    return this._get(options);
  }

  /**
   * Create a new call log
   * @param params - Call log data
   * @param params.to_phone_number - The number called (required)
   * @param params.outcome - Call result: connected, no_answer, left_message, left_voicemail, wrong_number, busy (required)
   * @param params.start_time - Call start in UTC YYYY-MM-DD HH:MM:SS (required)
   * @param params.end_time - Call end in UTC YYYY-MM-DD HH:MM:SS (required)
   * @param params.person_id - Associated person ID
   * @param params.org_id - Associated organization ID
   * @param params.deal_id - Associated deal ID
   * @param params.subject - Activity name/subject
   * @param params.duration - Duration in seconds
   * @param params.from_phone_number - Caller's number
   * @param params.note - Notes in HTML format
   * @returns Response with created call log data
   */
  async createCallLog(params: CreateCallLogParams): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.callLogs,
      body: params,
      headers: {
        "Content-Type": "application/json",
      },
    };
    return this._post(options);
  }

  /**
   * Update an existing call log
   * @param callLogId - The ID of the call log to update
   * @param params - Fields to update
   * @param params.outcome - Call result
   * @param params.subject - Activity name/subject
   * @param params.note - Notes in HTML format
   * @returns Response with updated call log data
   */
  async updateCallLog(
    callLogId: string,
    params: UpdateCallLogParams
  ): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.callLogById(callLogId),
      body: params,
      headers: {
        "Content-Type": "application/json",
      },
    };
    return this._patch(options);
  }

  /**
   * Delete a call log by ID
   * @param callLogId - The ID of the call log to delete
   * @returns Response confirming deletion
   */
  async deleteCallLog(callLogId: string): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.callLogById(callLogId),
    };
    return this._delete(options);
  }

  // **************************   Leads   **********************************
  /**
   * List leads with optional filtering
   * @param params - Query parameters for filtering and pagination
   * @param params.limit - Number of leads to return (default 100, max 500)
   * @param params.cursor - Pagination cursor from previous response
   * @param params.archived_status - Filter by archived status: 'archived' | 'not_archived' | 'all' (default: 'not_archived')
   * @param params.owner_id - Filter by owner user ID
   * @param params.person_id - Filter by associated person ID
   * @param params.org_id - Filter by associated organization ID
   * @param params.filter_id - Filter by saved filter ID
   * @param params.sort_by - Field to sort by
   * @param params.sort_direction - Sort direction: 'asc' | 'desc'
   * @returns Response with lead data array and pagination cursor
   */
  async listLeads(params?: ListLeadsParams): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.leads,
    };
    if (params && Object.keys(params).length > 0) {
      options.query = params;
    }
    return this._get(options);
  }

  /**
   * Get a single lead by ID
   * @param leadId - The UUID of the lead to retrieve
   * @returns Response with lead data
   */
  async getLead(leadId: string): Promise<PipedriveResponse> {
    const options: RequestOptions = {
      url: this.baseUrl + this.URLs.leadById(leadId),
    };
    return this._get(options);
  }
}
