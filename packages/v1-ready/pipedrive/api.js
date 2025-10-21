const {get, OAuth2Requester} = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        this.companyDomain = get(params, 'companyDomain', null);

        if (this.companyDomain) {
            this.baseUrl = `${this.companyDomain}/api`;
        }

        this.URLs = {
            activities: '/v2/activities',
            activityFields: '/v1/activityFields',
            activityById: (activityId) => `/v2/activities/${activityId}`,
            getUser: '/v1/users/me',
            users: '/v1/users',
            deals: '/v2/deals',
            persons: '/v2/persons',
            personById: (personId) => `/v2/persons/${personId}`,
        };

        this.authorizationUri = encodeURI(
            `https://oauth.pipedrive.com/oauth/authorize?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&scope=${this.scope}`
        );

        this.tokenUri = 'https://oauth.pipedrive.com/oauth/token';
    }

    /**
     * Sets OAuth tokens and captures the Pipedrive company domain
     * @param {Object} params - Token response from OAuth provider
     * @param {string} params.api_domain - The Pipedrive company-specific API domain (e.g., 'https://company.pipedrive.com')
     * @returns {Promise<Object>} Token response
     */
    async setTokens(params) {
        if (params.api_domain) {
            await this.setCompanyDomain(params.api_domain);
        } else if (!this.companyDomain) {
            throw new Error('Pipedrive api_domain not provided in token response');
        }
        return super.setTokens(params);
    }

    /**
     * Sets the company domain and updates the base URL for API requests
     * @param {string} companyDomain - The Pipedrive company domain (e.g., 'https://company.pipedrive.com' or 'company.pipedrive.com')
     */
    async setCompanyDomain(companyDomain) {
        if (!companyDomain) {
            throw new Error('Company domain is required for Pipedrive API');
        }

        const formattedDomain = companyDomain.startsWith('http')
            ? companyDomain
            : `https://${companyDomain}`;

        this.companyDomain = formattedDomain;
        this.baseUrl = `${this.companyDomain}/api`;
    }

    // **************************   Deals   **********************************
    /**
     * List deals with v2 API support
     * @param {Object} params - Query parameters
     * @param {string} params.cursor - Pagination cursor from previous response
     * @param {number} params.limit - Number of items per page (default 100, max 500)
     * @param {number} params.filter_id - Filter by filter ID
     * @param {number} params.stage_id - Filter by stage ID
     * @param {string} params.status - Filter by status (open, won, lost, deleted, all_not_deleted)
     * @param {number} params.user_id - Filter by user ID
     * @param {number} params.org_id - Filter by organization ID
     * @param {number} params.person_id - Filter by person ID
     * @returns {Promise<Object>} Response with data array and additional_data.next_cursor
     */
    async listDeals(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.deals,
        };
        if (params && Object.keys(params).length > 0) {
            options.query = params;
        }
        return this._get(options);
    }

    // **************************   Activities   **********************************
    async listActivityFields() {
        const options = {
            url: this.baseUrl + this.URLs.activityFields,
        };
        return this._get(options);
    }

    /**
     * List activities with v2 API support
     * @param {Object} params - Query parameters
     * @param {string} params.cursor - Pagination cursor from previous response
     * @param {number} params.limit - Number of items per page (default 100, max 500)
     * @param {number} params.user_id - Filter by user ID
     * @param {number} params.filter_id - Filter by filter ID
     * @param {string} params.type - Filter by activity type
     * @param {string} params.start_date - Filter by start date (RFC 3339 format)
     * @param {string} params.end_date - Filter by end date (RFC 3339 format)
     * @param {boolean} params.done - Filter by done status
     * @returns {Promise<Object>} Response with data array and additional_data.next_cursor
     */
    async listActivities(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.activities,
        };
        if (params && Object.keys(params).length > 0) {
            options.query = params;
        }
        return this._get(options);
    }

    async deleteActivity(activityId) {
        const options = {
            url: this.baseUrl + this.URLs.activityById(activityId),
        };
        return this._delete(options);
    }

    async updateActivity(activityId, task) {
        const options = {
            url: this.baseUrl + this.URLs.activityById(activityId),
            body: task,
        };
        return this._patch(options);
    }

    async createActivity(params) {
        const dealId = get(params, 'dealId', null);
        const subject = get(params, 'subject');
        const type = get(params, 'type');
        const options = {
            url: this.baseUrl + this.URLs.activities,
            body: {...params},
            headers: {
                'Content-Type': 'application/json',
            },
        };
        return this._post(options);
    }

    // **************************   Users   **********************************
    async getUser() {
        const options = {
            url: this.baseUrl + this.URLs.getUser,
        };
        return this._get(options);
    }

    async listUsers() {
        const options = {
            url: this.baseUrl + this.URLs.users,
        };
        return this._get(options);
    }

    // **************************   Persons   **********************************
    /**
     * List persons with v2 API support and pagination
     * @param {Object} params - Query parameters
     * @param {string} params.cursor - Pagination cursor from previous response (opaque string)
     * @param {number} params.limit - Number of items per page (default 100, max 500)
     * @param {number} params.filter_id - Filter by pre-configured filter ID
     * @param {number} params.owner_id - Filter by owner (user) ID
     * @param {number} params.org_id - Filter by organization ID
     * @param {string} params.updated_since - Filter by update time (RFC 3339 format, e.g., '2025-01-01T00:00:00Z')
     * @param {string} params.updated_until - Filter by update time upper bound (RFC 3339 format)
     * @param {string} params.sort_by - Sort field: 'id', 'update_time', 'add_time'
     * @param {string} params.sort_direction - Sort direction: 'asc' or 'desc'
     * @param {string} params.include_fields - Additional fields to include (e.g., 'marketing_status,doi_status')
     * @param {string} params.custom_fields - Comma-separated custom field keys (max 15)
     * @returns {Promise<Object>} Response with data array and additional_data.next_cursor
     */
    async listPersons(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.persons,
        };
        if (params && Object.keys(params).length > 0) {
            options.query = params;
        }
        return this._get(options);
    }

    /**
     * Get a single person by ID
     * @param {number} personId - The ID of the person to retrieve
     * @param {Object} params - Query parameters
     * @param {string} params.include_fields - Additional fields to include (e.g., 'marketing_status,doi_status')
     * @param {string} params.custom_fields - Comma-separated custom field keys (max 15)
     * @returns {Promise<Object>} Response with person data
     */
    async getPerson(personId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.personById(personId),
        };
        if (params && Object.keys(params).length > 0) {
            options.query = params;
        }
        return this._get(options);
    }
}

module.exports = {Api};
