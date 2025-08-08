const { ApiClass } = require('@friggframework/core');

class MixpanelApi extends ApiClass {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.mixpanel.com';
        this.ingestionUrl = 'https://api.mixpanel.com';
        this.projectToken = params.projectToken;
        this.serviceAccountUsername = params.serviceAccountUsername;
        this.serviceAccountSecret = params.serviceAccountSecret;
        
        // Set up basic auth for service account
        if (this.serviceAccountUsername && this.serviceAccountSecret) {
            this.authHeader = 'Basic ' + Buffer.from(
                `${this.serviceAccountUsername}:${this.serviceAccountSecret}`
            ).toString('base64');
        }
    }

    /**
     * Get authorization headers
     * @returns {Object} Headers with authorization
     */
    _getAuthHeaders() {
        return {
            'Authorization': this.authHeader,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
    }

    /**
     * Track a single event
     * @param {Object} event - Event data with properties
     * @returns {Promise<Object>} Tracking response
     */
    async track(event) {
        const data = [{
            event: event.event,
            properties: {
                ...event.properties,
                token: this.projectToken,
                time: event.time || Math.floor(Date.now() / 1000),
                distinct_id: event.distinct_id || event.properties.distinct_id
            }
        }];

        const url = `${this.ingestionUrl}/import`;
        return this._post(url, data, { headers: this._getAuthHeaders() });
    }

    /**
     * Track multiple events in batch
     * @param {Array} events - Array of event objects
     * @returns {Promise<Object>} Batch tracking response
     */
    async trackBatch(events) {
        const data = events.map(event => ({
            event: event.event,
            properties: {
                ...event.properties,
                token: this.projectToken,
                time: event.time || Math.floor(Date.now() / 1000),
                distinct_id: event.distinct_id || event.properties.distinct_id
            }
        }));

        const url = `${this.ingestionUrl}/import`;
        return this._post(url, data, { headers: this._getAuthHeaders() });
    }

    /**
     * Update user profile
     * @param {Object} profile - Profile data
     * @returns {Promise<Object>} Profile update response
     */
    async updateProfile(profile) {
        const data = [{
            $token: this.projectToken,
            $distinct_id: profile.distinct_id,
            $set: profile.properties || {},
            $ip: profile.ip,
            $time: profile.time || Math.floor(Date.now() / 1000)
        }];

        const url = `${this.ingestionUrl}/engage`;
        return this._post(url, data, { headers: this._getAuthHeaders() });
    }

    /**
     * Update multiple profiles in batch
     * @param {Array} profiles - Array of profile objects
     * @returns {Promise<Object>} Batch profile update response
     */
    async updateProfilesBatch(profiles) {
        const data = profiles.map(profile => ({
            $token: this.projectToken,
            $distinct_id: profile.distinct_id,
            $set: profile.properties || {},
            $ip: profile.ip,
            $time: profile.time || Math.floor(Date.now() / 1000)
        }));

        const url = `${this.ingestionUrl}/engage`;
        return this._post(url, data, { headers: this._getAuthHeaders() });
    }

    /**
     * Update group profile
     * @param {Object} group - Group data
     * @returns {Promise<Object>} Group update response
     */
    async updateGroup(group) {
        const data = [{
            $token: this.projectToken,
            $group_key: group.group_key,
            $group_id: group.group_id,
            $set: group.properties || {},
            $time: group.time || Math.floor(Date.now() / 1000)
        }];

        const url = `${this.ingestionUrl}/groups`;
        return this._post(url, data, { headers: this._getAuthHeaders() });
    }

    /**
     * Query using JQL (JSON Query Language)
     * @param {Object} params - JQL query parameters
     * @returns {Promise<Object>} Query results
     */
    async queryJQL(params) {
        const url = `${this.baseUrl}/api/2.0/jql`;
        return this._post(url, params, { headers: this._getAuthHeaders() });
    }

    /**
     * Get funnel analysis
     * @param {Object} params - Funnel parameters
     * @returns {Promise<Object>} Funnel data
     */
    async getFunnel(params) {
        const url = `${this.baseUrl}/api/2.0/funnels`;
        const queryString = new URLSearchParams(params).toString();
        return this._get(`${url}?${queryString}`, { headers: this._getAuthHeaders() });
    }

    /**
     * Get retention analysis
     * @param {Object} params - Retention parameters
     * @returns {Promise<Object>} Retention data
     */
    async getRetention(params) {
        const url = `${this.baseUrl}/api/2.0/retention`;
        const queryString = new URLSearchParams(params).toString();
        return this._get(`${url}?${queryString}`, { headers: this._getAuthHeaders() });
    }

    /**
     * Get insights (saved reports)
     * @param {number} projectId - Project ID
     * @returns {Promise<Array>} List of insights
     */
    async getInsights(projectId) {
        const url = `${this.baseUrl}/api/2.0/insights`;
        const queryString = new URLSearchParams({ project_id: projectId }).toString();
        return this._get(`${url}?${queryString}`, { headers: this._getAuthHeaders() });
    }

    /**
     * Export raw event data
     * @param {Object} params - Export parameters
     * @returns {Promise<Object>} Export data
     */
    async exportEvents(params) {
        const url = `${this.baseUrl}/api/2.0/export`;
        const queryString = new URLSearchParams(params).toString();
        return this._get(`${url}?${queryString}`, { headers: this._getAuthHeaders() });
    }

    /**
     * Export people profiles
     * @param {Object} params - Export parameters
     * @returns {Promise<Object>} People data
     */
    async exportPeople(params) {
        const url = `${this.baseUrl}/api/2.0/engage`;
        const queryString = new URLSearchParams(params).toString();
        return this._get(`${url}?${queryString}`, { headers: this._getAuthHeaders() });
    }

    /**
     * Get project details
     * @param {number} projectId - Project ID
     * @returns {Promise<Object>} Project details
     */
    async getProject(projectId) {
        const url = `${this.baseUrl}/api/app/projects/${projectId}`;
        return this._get(url, { headers: this._getAuthHeaders() });
    }

    /**
     * List all projects
     * @returns {Promise<Array>} List of projects
     */
    async listProjects() {
        const url = `${this.baseUrl}/api/app/me`;
        const response = await this._get(url, { headers: this._getAuthHeaders() });
        return response.results || [];
    }

    /**
     * Get cohorts
     * @param {number} projectId - Project ID
     * @returns {Promise<Array>} List of cohorts
     */
    async getCohorts(projectId) {
        const url = `${this.baseUrl}/api/2.0/cohorts/list`;
        const queryString = new URLSearchParams({ project_id: projectId }).toString();
        return this._get(`${url}?${queryString}`, { headers: this._getAuthHeaders() });
    }

    /**
     * Create a cohort
     * @param {number} projectId - Project ID
     * @param {Object} cohort - Cohort configuration
     * @returns {Promise<Object>} Created cohort
     */
    async createCohort(projectId, cohort) {
        const url = `${this.baseUrl}/api/2.0/cohorts/create`;
        const data = {
            project_id: projectId,
            ...cohort
        };
        return this._post(url, data, { headers: this._getAuthHeaders() });
    }

    /**
     * Get annotations
     * @param {Object} params - Query parameters
     * @returns {Promise<Array>} List of annotations
     */
    async getAnnotations(params) {
        const url = `${this.baseUrl}/api/2.0/annotations`;
        const queryString = new URLSearchParams(params).toString();
        return this._get(`${url}?${queryString}`, { headers: this._getAuthHeaders() });
    }

    /**
     * Create an annotation
     * @param {Object} annotation - Annotation data
     * @returns {Promise<Object>} Created annotation
     */
    async createAnnotation(annotation) {
        const url = `${this.baseUrl}/api/2.0/annotations/create`;
        return this._post(url, annotation, { headers: this._getAuthHeaders() });
    }

    /**
     * Delete user data (GDPR compliance)
     * @param {Object} params - Deletion parameters
     * @returns {Promise<Object>} Deletion response
     */
    async deleteUserData(params) {
        const url = `${this.baseUrl}/api/2.0/engage/delete`;
        return this._post(url, params, { headers: this._getAuthHeaders() });
    }

    /**
     * Get segmentation data
     * @param {Object} params - Segmentation parameters
     * @returns {Promise<Object>} Segmentation results
     */
    async getSegmentation(params) {
        const url = `${this.baseUrl}/api/2.0/segmentation`;
        const queryString = new URLSearchParams(params).toString();
        return this._get(`${url}?${queryString}`, { headers: this._getAuthHeaders() });
    }

    /**
     * Get property values for an event
     * @param {Object} params - Parameters including event name
     * @returns {Promise<Array>} Property values
     */
    async getPropertyValues(params) {
        const url = `${this.baseUrl}/api/2.0/events/properties/values`;
        const queryString = new URLSearchParams(params).toString();
        return this._get(`${url}?${queryString}`, { headers: this._getAuthHeaders() });
    }

    /**
     * Get top events
     * @param {Object} params - Query parameters
     * @returns {Promise<Array>} Top events
     */
    async getTopEvents(params) {
        const url = `${this.baseUrl}/api/2.0/events/names`;
        const queryString = new URLSearchParams(params).toString();
        return this._get(`${url}?${queryString}`, { headers: this._getAuthHeaders() });
    }

    /**
     * Create or update lookup table
     * @param {Object} table - Lookup table data
     * @returns {Promise<Object>} Table response
     */
    async updateLookupTable(table) {
        const url = `${this.baseUrl}/api/2.0/lookup-tables`;
        return this._post(url, table, { headers: this._getAuthHeaders() });
    }
}

module.exports = MixpanelApi;