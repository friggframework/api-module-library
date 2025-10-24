import { get, OAuth2Requester, RequestOptions } from "@friggframework/core";
import {
  OAuth2RequesterOptions,
  ActivityParams,
  ListActivitiesParams,
  ListDealsParams,
  ListPersonsParams,
  GetPersonParams,
  ListOrganizationsParams,
  GetOrganizationParams,
  PipedriveResponse,
  PipedriveUser,
  PipedriveTokenResponse,
  CreateWebhookParams,
} from "./types";

export class Api extends OAuth2Requester {
  companyDomain: string | null;
  URLs: {
    activities: string;
    activityFields: string;
    activityById: (activityId: string | number) => string;
    getUser: string;
    users: string;
    deals: string;
    persons: string;
    personById: (personId: string | number) => string;
    organizations: string;
    organizationById: (orgId: string | number) => string;
    webhooks: string;
    webhookById: (webhookId: string | number) => string;
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
      deals: "/v2/deals",
      persons: "/v2/persons",
      personById: (personId: string | number) => `/v2/persons/${personId}`,
      organizations: "/v2/organizations",
      organizationById: (orgId: string | number) => `/v2/organizations/${orgId}`,
      webhooks: "/v1/webhooks",
      webhookById: (webhookId: string | number) => `/v1/webhooks/${webhookId}`,
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
    };
    return this._patch(options);
  }

  async createActivity(params: ActivityParams): Promise<PipedriveResponse> {
    const dealId = get(params, "dealId", null);
    const subject = get(params, "subject");
    const type = get(params, "type");
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
}
