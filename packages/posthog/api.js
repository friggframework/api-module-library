const { ApiClass } = require('@friggframework/core');

class PostHogApi extends ApiClass {
    constructor(params) {
        super(params);
        this.baseUrl = params.host || 'https://app.posthog.com';
        this.projectApiKey = params.projectApiKey;
        this.personalApiKey = params.personalApiKey;
    }

    /**
     * Get authorization headers based on request type
     * @param {boolean} usePersonalKey - Whether to use personal API key
     * @returns {Object} Headers with authorization
     */
    _getAuthHeaders(usePersonalKey = true) {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (usePersonalKey && this.personalApiKey) {
            headers['Authorization'] = `Bearer ${this.personalApiKey}`;
        }

        return headers;
    }

    /**
     * Capture an event
     * @param {Object} event - Event data
     * @returns {Promise<Object>} Response
     */
    async capture(event) {
        const eventData = {
            api_key: this.projectApiKey,
            event: event.event,
            properties: {
                distinct_id: event.distinctId || event.distinct_id,
                ...event.properties
            },
            timestamp: event.timestamp || new Date().toISOString()
        };

        const url = `${this.baseUrl}/i/v0/e/`;
        return this._post(url, eventData);
    }

    /**
     * Capture multiple events in batch
     * @param {Array} events - Array of events
     * @returns {Promise<Object>} Response
     */
    async batch(events) {
        const batch = {
            api_key: this.projectApiKey,
            batch: events.map(event => ({
                event: event.event,
                properties: {
                    distinct_id: event.distinctId || event.distinct_id,
                    ...event.properties
                },
                timestamp: event.timestamp || new Date().toISOString()
            }))
        };

        const url = `${this.baseUrl}/batch/`;
        return this._post(url, batch);
    }

    /**
     * Identify a person
     * @param {Object} identify - Identify data
     * @returns {Promise<Object>} Response
     */
    async identify(identify) {
        const identifyData = {
            api_key: this.projectApiKey,
            event: '$identify',
            properties: {
                distinct_id: identify.distinctId || identify.distinct_id,
                $set: identify.properties || {},
                $set_once: identify.setOnce || {}
            },
            timestamp: identify.timestamp || new Date().toISOString()
        };

        const url = `${this.baseUrl}/i/v0/e/`;
        return this._post(url, identifyData);
    }

    /**
     * Alias person IDs
     * @param {Object} alias - Alias data
     * @returns {Promise<Object>} Response
     */
    async alias(alias) {
        const aliasData = {
            api_key: this.projectApiKey,
            event: '$create_alias',
            properties: {
                distinct_id: alias.distinctId || alias.distinct_id,
                alias: alias.alias
            },
            timestamp: alias.timestamp || new Date().toISOString()
        };

        const url = `${this.baseUrl}/i/v0/e/`;
        return this._post(url, aliasData);
    }

    /**
     * Get person by distinct ID
     * @param {string} distinctId - Person's distinct ID
     * @returns {Promise<Object>} Person data
     */
    async getPerson(distinctId) {
        const url = `${this.baseUrl}/api/projects/@current/persons/${distinctId}/`;
        return this._get(url, { headers: this._getAuthHeaders() });
    }

    /**
     * Get persons list with filters
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Persons list
     */
    async getPersons(params = {}) {
        const url = `${this.baseUrl}/api/projects/@current/persons/`;
        const queryString = new URLSearchParams(params).toString();
        return this._get(`${url}?${queryString}`, { headers: this._getAuthHeaders() });
    }

    /**
     * Update person properties
     * @param {string} distinctId - Person's distinct ID
     * @param {Object} properties - Properties to update
     * @returns {Promise<Object>} Updated person
     */
    async updatePerson(distinctId, properties) {
        const url = `${this.baseUrl}/api/projects/@current/persons/${distinctId}/`;
        return this._patch(url, { properties }, { headers: this._getAuthHeaders() });
    }

    /**
     * Delete person
     * @param {string} distinctId - Person's distinct ID
     * @returns {Promise<Object>} Deletion response
     */
    async deletePerson(distinctId) {
        const url = `${this.baseUrl}/api/projects/@current/persons/${distinctId}/`;
        return this._delete(url, { headers: this._getAuthHeaders() });
    }

    /**
     * Get insights (saved queries)
     * @param {Object} params - Query parameters
     * @returns {Promise<Array>} List of insights
     */
    async getInsights(params = {}) {
        const url = `${this.baseUrl}/api/projects/@current/insights/`;
        const queryString = new URLSearchParams(params).toString();
        const response = await this._get(`${url}?${queryString}`, { headers: this._getAuthHeaders() });
        return response.results || [];
    }

    /**
     * Get specific insight
     * @param {number} insightId - Insight ID
     * @returns {Promise<Object>} Insight data
     */
    async getInsight(insightId) {
        const url = `${this.baseUrl}/api/projects/@current/insights/${insightId}/`;
        return this._get(url, { headers: this._getAuthHeaders() });
    }

    /**
     * Create an insight
     * @param {Object} insight - Insight configuration
     * @returns {Promise<Object>} Created insight
     */
    async createInsight(insight) {
        const url = `${this.baseUrl}/api/projects/@current/insights/`;
        return this._post(url, insight, { headers: this._getAuthHeaders() });
    }

    /**
     * Get feature flags
     * @returns {Promise<Array>} List of feature flags
     */
    async getFeatureFlags() {
        const url = `${this.baseUrl}/api/projects/@current/feature_flags/`;
        const response = await this._get(url, { headers: this._getAuthHeaders() });
        return response.results || [];
    }

    /**
     * Get specific feature flag
     * @param {number} flagId - Feature flag ID
     * @returns {Promise<Object>} Feature flag data
     */
    async getFeatureFlag(flagId) {
        const url = `${this.baseUrl}/api/projects/@current/feature_flags/${flagId}/`;
        return this._get(url, { headers: this._getAuthHeaders() });
    }

    /**
     * Create feature flag
     * @param {Object} flag - Feature flag configuration
     * @returns {Promise<Object>} Created feature flag
     */
    async createFeatureFlag(flag) {
        const url = `${this.baseUrl}/api/projects/@current/feature_flags/`;
        return this._post(url, flag, { headers: this._getAuthHeaders() });
    }

    /**
     * Update feature flag
     * @param {number} flagId - Feature flag ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<Object>} Updated feature flag
     */
    async updateFeatureFlag(flagId, updates) {
        const url = `${this.baseUrl}/api/projects/@current/feature_flags/${flagId}/`;
        return this._patch(url, updates, { headers: this._getAuthHeaders() });
    }

    /**
     * Evaluate feature flags for a person
     * @param {string} distinctId - Person's distinct ID
     * @param {Object} options - Evaluation options
     * @returns {Promise<Object>} Feature flag values
     */
    async evaluateFeatureFlags(distinctId, options = {}) {
        const url = `${this.baseUrl}/decide/`;
        const data = {
            api_key: this.projectApiKey,
            distinct_id: distinctId,
            groups: options.groups || {},
            person_properties: options.personProperties || {},
            group_properties: options.groupProperties || {}
        };

        return this._post(url, data);
    }

    /**
     * Get cohorts
     * @returns {Promise<Array>} List of cohorts
     */
    async getCohorts() {
        const url = `${this.baseUrl}/api/projects/@current/cohorts/`;
        const response = await this._get(url, { headers: this._getAuthHeaders() });
        return response.results || [];
    }

    /**
     * Get specific cohort
     * @param {number} cohortId - Cohort ID
     * @returns {Promise<Object>} Cohort data
     */
    async getCohort(cohortId) {
        const url = `${this.baseUrl}/api/projects/@current/cohorts/${cohortId}/`;
        return this._get(url, { headers: this._getAuthHeaders() });
    }

    /**
     * Create cohort
     * @param {Object} cohort - Cohort configuration
     * @returns {Promise<Object>} Created cohort
     */
    async createCohort(cohort) {
        const url = `${this.baseUrl}/api/projects/@current/cohorts/`;
        return this._post(url, cohort, { headers: this._getAuthHeaders() });
    }

    /**
     * Get annotations
     * @param {Object} params - Query parameters
     * @returns {Promise<Array>} List of annotations
     */
    async getAnnotations(params = {}) {
        const url = `${this.baseUrl}/api/projects/@current/annotations/`;
        const queryString = new URLSearchParams(params).toString();
        const response = await this._get(`${url}?${queryString}`, { headers: this._getAuthHeaders() });
        return response.results || [];
    }

    /**
     * Create annotation
     * @param {Object} annotation - Annotation data
     * @returns {Promise<Object>} Created annotation
     */
    async createAnnotation(annotation) {
        const url = `${this.baseUrl}/api/projects/@current/annotations/`;
        return this._post(url, annotation, { headers: this._getAuthHeaders() });
    }

    /**
     * Get dashboards
     * @returns {Promise<Array>} List of dashboards
     */
    async getDashboards() {
        const url = `${this.baseUrl}/api/projects/@current/dashboards/`;
        const response = await this._get(url, { headers: this._getAuthHeaders() });
        return response.results || [];
    }

    /**
     * Get specific dashboard
     * @param {number} dashboardId - Dashboard ID
     * @returns {Promise<Object>} Dashboard data
     */
    async getDashboard(dashboardId) {
        const url = `${this.baseUrl}/api/projects/@current/dashboards/${dashboardId}/`;
        return this._get(url, { headers: this._getAuthHeaders() });
    }

    /**
     * Get session recordings
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Session recordings
     */
    async getSessionRecordings(params = {}) {
        const url = `${this.baseUrl}/api/projects/@current/session_recordings/`;
        const queryString = new URLSearchParams(params).toString();
        return this._get(`${url}?${queryString}`, { headers: this._getAuthHeaders() });
    }

    /**
     * Get specific session recording
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Session recording data
     */
    async getSessionRecording(sessionId) {
        const url = `${this.baseUrl}/api/projects/@current/session_recordings/${sessionId}/`;
        return this._get(url, { headers: this._getAuthHeaders() });
    }

    /**
     * Get events
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Events list
     */
    async getEvents(params = {}) {
        const url = `${this.baseUrl}/api/projects/@current/events/`;
        const queryString = new URLSearchParams(params).toString();
        return this._get(`${url}?${queryString}`, { headers: this._getAuthHeaders() });
    }

    /**
     * Get event definitions
     * @returns {Promise<Array>} Event definitions
     */
    async getEventDefinitions() {
        const url = `${this.baseUrl}/api/projects/@current/event_definitions/`;
        const response = await this._get(url, { headers: this._getAuthHeaders() });
        return response.results || [];
    }

    /**
     * Get property definitions
     * @returns {Promise<Array>} Property definitions
     */
    async getPropertyDefinitions() {
        const url = `${this.baseUrl}/api/projects/@current/property_definitions/`;
        const response = await this._get(url, { headers: this._getAuthHeaders() });
        return response.results || [];
    }

    /**
     * Get actions
     * @returns {Promise<Array>} List of actions
     */
    async getActions() {
        const url = `${this.baseUrl}/api/projects/@current/actions/`;
        const response = await this._get(url, { headers: this._getAuthHeaders() });
        return response.results || [];
    }

    /**
     * Create action
     * @param {Object} action - Action configuration
     * @returns {Promise<Object>} Created action
     */
    async createAction(action) {
        const url = `${this.baseUrl}/api/projects/@current/actions/`;
        return this._post(url, action, { headers: this._getAuthHeaders() });
    }

    /**
     * Get experiments
     * @returns {Promise<Array>} List of experiments
     */
    async getExperiments() {
        const url = `${this.baseUrl}/api/projects/@current/experiments/`;
        const response = await this._get(url, { headers: this._getAuthHeaders() });
        return response.results || [];
    }

    /**
     * Create experiment
     * @param {Object} experiment - Experiment configuration
     * @returns {Promise<Object>} Created experiment
     */
    async createExperiment(experiment) {
        const url = `${this.baseUrl}/api/projects/@current/experiments/`;
        return this._post(url, experiment, { headers: this._getAuthHeaders() });
    }

    /**
     * Get project details
     * @returns {Promise<Object>} Project details
     */
    async getProject() {
        const url = `${this.baseUrl}/api/projects/@current/`;
        return this._get(url, { headers: this._getAuthHeaders() });
    }

    /**
     * Update project settings
     * @param {Object} settings - Project settings to update
     * @returns {Promise<Object>} Updated project
     */
    async updateProject(settings) {
        const url = `${this.baseUrl}/api/projects/@current/`;
        return this._patch(url, settings, { headers: this._getAuthHeaders() });
    }
}

module.exports = PostHogApi;