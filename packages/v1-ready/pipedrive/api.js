const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.pipedrive.com/api/v2';

        // OAuth2 configuration
        this.authorizationUri = 'https://oauth.pipedrive.com/oauth/authorize';
        this.tokenUri = 'https://oauth.pipedrive.com/oauth/token';
        this.client_id = get(params, 'client_id', process.env.PIPEDRIVE_CLIENT_ID);
        this.client_secret = get(params, 'client_secret', process.env.PIPEDRIVE_CLIENT_SECRET);
        this.redirect_uri = get(params, 'redirect_uri', process.env.PIPEDRIVE_REDIRECT_URI);

        this.URLs = {
            // Activities endpoints
            activities: '/activities',
            activityById: (activityId) => `/activities/${activityId}`,

            // Deals endpoints
            deals: '/deals',
            dealById: (dealId) => `/deals/${dealId}`,

            // Products endpoints
            products: '/products',
            productById: (productId) => `/products/${productId}`,

            // Leads endpoints
            leads: '/leads',
            leadById: (leadId) => `/leads/${leadId}`,

            // Organizations endpoints
            organizations: '/organizations',
            organizationById: (orgId) => `/organizations/${orgId}`,

            // Persons endpoints
            persons: '/persons',
            personById: (personId) => `/persons/${personId}`,

            // Pipelines endpoints
            pipelines: '/pipelines',
            pipelineById: (pipelineId) => `/pipelines/${pipelineId}`,

            // Stages endpoints
            stages: '/stages',
            stageById: (stageId) => `/stages/${stageId}`,

            // Users endpoints
            users: '/users',
            userById: (userId) => `/users/${userId}`,

            // Search endpoints
            itemSearch: '/itemSearch',
        };
    }

    async getAuthorizationUri() {
        return `${this.authorizationUri}?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code`;
    }

    // Activities API methods
    async getActivities(options = {}) {
        const query = this._cleanParams({
            filter_id: options.filter_id,
            ids: options.ids,
            owner_id: options.owner_id,
            deal_id: options.deal_id,
            lead_id: options.lead_id,
            person_id: options.person_id,
            org_id: options.org_id,
            done: options.done,
            updated_since: options.updated_since,
            updated_until: options.updated_until,
            sort_by: options.sort_by || 'id',
            sort_direction: options.sort_direction || 'asc',
            include_fields: options.include_fields,
            limit: options.limit || 100,
            cursor: options.cursor
        });

        return this._get({
            url: this.baseUrl + this.URLs.activities,
            query
        });
    }

    async getActivityById(activityId) {
        return this._get({
            url: this.baseUrl + this.URLs.activityById(activityId)
        });
    }

    async createActivity(body) {
        return this._post({
            url: this.baseUrl + this.URLs.activities,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async updateActivity(activityId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.activityById(activityId),
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async deleteActivity(activityId) {
        return this._delete({
            url: this.baseUrl + this.URLs.activityById(activityId)
        });
    }

    // Deals API methods
    async getDeals(options = {}) {
        const query = this._cleanParams({
            filter_id: options.filter_id,
            ids: options.ids,
            owner_id: options.owner_id,
            stage_id: options.stage_id,
            status: options.status,
            updated_since: options.updated_since,
            updated_until: options.updated_until,
            sort_by: options.sort_by || 'id',
            sort_direction: options.sort_direction || 'asc',
            limit: options.limit || 100,
            cursor: options.cursor
        });

        return this._get({
            url: this.baseUrl + this.URLs.deals,
            query
        });
    }

    async getDealById(dealId) {
        return this._get({
            url: this.baseUrl + this.URLs.dealById(dealId)
        });
    }

    async createDeal(body) {
        return this._post({
            url: this.baseUrl + this.URLs.deals,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async updateDeal(dealId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.dealById(dealId),
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async deleteDeal(dealId) {
        return this._delete({
            url: this.baseUrl + this.URLs.dealById(dealId)
        });
    }

    // Products API methods
    async getProducts(options = {}) {
        const query = this._cleanParams({
            filter_id: options.filter_id,
            ids: options.ids,
            owner_id: options.owner_id,
            updated_since: options.updated_since,
            updated_until: options.updated_until,
            sort_by: options.sort_by || 'id',
            sort_direction: options.sort_direction || 'asc',
            limit: options.limit || 100,
            cursor: options.cursor
        });

        return this._get({
            url: this.baseUrl + this.URLs.products,
            query
        });
    }

    async getProductById(productId) {
        return this._get({
            url: this.baseUrl + this.URLs.productById(productId)
        });
    }

    async createProduct(body) {
        return this._post({
            url: this.baseUrl + this.URLs.products,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async updateProduct(productId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.productById(productId),
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async deleteProduct(productId) {
        return this._delete({
            url: this.baseUrl + this.URLs.productById(productId)
        });
    }

    // Leads API methods
    async getLeads(options = {}) {
        const query = this._cleanParams({
            filter_id: options.filter_id,
            ids: options.ids,
            owner_id: options.owner_id,
            updated_since: options.updated_since,
            updated_until: options.updated_until,
            sort_by: options.sort_by || 'id',
            sort_direction: options.sort_direction || 'asc',
            limit: options.limit || 100,
            cursor: options.cursor
        });

        return this._get({
            url: this.baseUrl + this.URLs.leads,
            query
        });
    }

    async getLeadById(leadId) {
        return this._get({
            url: this.baseUrl + this.URLs.leadById(leadId)
        });
    }

    async createLead(body) {
        return this._post({
            url: this.baseUrl + this.URLs.leads,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async updateLead(leadId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.leadById(leadId),
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async deleteLead(leadId) {
        return this._delete({
            url: this.baseUrl + this.URLs.leadById(leadId)
        });
    }

    // Organizations API methods
    async getOrganizations(options = {}) {
        const query = this._cleanParams({
            filter_id: options.filter_id,
            ids: options.ids,
            owner_id: options.owner_id,
            updated_since: options.updated_since,
            updated_until: options.updated_until,
            sort_by: options.sort_by || 'id',
            sort_direction: options.sort_direction || 'asc',
            limit: options.limit || 100,
            cursor: options.cursor
        });

        return this._get({
            url: this.baseUrl + this.URLs.organizations,
            query
        });
    }

    async getOrganizationById(orgId) {
        return this._get({
            url: this.baseUrl + this.URLs.organizationById(orgId)
        });
    }

    async createOrganization(body) {
        return this._post({
            url: this.baseUrl + this.URLs.organizations,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async updateOrganization(orgId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.organizationById(orgId),
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async deleteOrganization(orgId) {
        return this._delete({
            url: this.baseUrl + this.URLs.organizationById(orgId)
        });
    }

    // Persons API methods
    async getPersons(options = {}) {
        const query = this._cleanParams({
            filter_id: options.filter_id,
            ids: options.ids,
            owner_id: options.owner_id,
            org_id: options.org_id,
            updated_since: options.updated_since,
            updated_until: options.updated_until,
            sort_by: options.sort_by || 'id',
            sort_direction: options.sort_direction || 'asc',
            limit: options.limit || 100,
            cursor: options.cursor
        });

        return this._get({
            url: this.baseUrl + this.URLs.persons,
            query
        });
    }

    async getPersonById(personId) {
        return this._get({
            url: this.baseUrl + this.URLs.personById(personId)
        });
    }

    async createPerson(body) {
        return this._post({
            url: this.baseUrl + this.URLs.persons,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async updatePerson(personId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.personById(personId),
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async deletePerson(personId) {
        return this._delete({
            url: this.baseUrl + this.URLs.personById(personId)
        });
    }

    // Pipelines API methods
    async getPipelines(options = {}) {
        const query = this._cleanParams(options);
        return this._get({
            url: this.baseUrl + this.URLs.pipelines,
            query
        });
    }

    async getPipelineById(pipelineId) {
        return this._get({
            url: this.baseUrl + this.URLs.pipelineById(pipelineId)
        });
    }

    // Stages API methods
    async getStages(options = {}) {
        const query = this._cleanParams(options);
        return this._get({
            url: this.baseUrl + this.URLs.stages,
            query
        });
    }

    async getStageById(stageId) {
        return this._get({
            url: this.baseUrl + this.URLs.stageById(stageId)
        });
    }

    // Users API methods
    async getUsers(options = {}) {
        const query = this._cleanParams(options);
        return this._get({
            url: this.baseUrl + this.URLs.users,
            query
        });
    }

    async getUserById(userId) {
        return this._get({
            url: this.baseUrl + this.URLs.userById(userId)
        });
    }

    async getCurrentUser() {
        const users = await this.getUsers();
        return users.data && users.data.length > 0 ? users.data[0] : null;
    }

    // Search API methods
    async search(options = {}) {
        const query = this._cleanParams(options);
        return this._get({
            url: this.baseUrl + this.URLs.itemSearch,
            query
        });
    }

    // Helper methods
    _cleanParams(params) {
        const cleaned = {};
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                cleaned[key] = params[key];
            }
        });
        return cleaned;
    }
}

module.exports = { Api };
