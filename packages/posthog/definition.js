const { Integration } = require('@friggframework/module-plugin');
const ApiClass = require('./api');

class PostHogIntegration extends Integration {
    static name = 'PostHog';
    static category = 'Analytics';
    static catalogDescription = 'Open source product analytics platform with feature flags and session recording';
    static version = '1.0.0';
    static referenceUrl = 'https://posthog.com';
    static apiDocs = 'https://posthog.com/docs/api';

    /**
     * Constructor for PostHogIntegration
     * @param {Object} params - Should include personalApiKey and/or projectApiKey
     */
    constructor(params) {
        super(params);
        this.api = new ApiClass(params);
    }

    /**
     * Capture an event
     * @param {Object} event - Event data
     * @returns {Promise<Object>} Response
     */
    async capture(event) {
        return this.api.capture(event);
    }

    /**
     * Capture multiple events in batch
     * @param {Array} events - Array of events
     * @returns {Promise<Object>} Response
     */
    async batch(events) {
        return this.api.batch(events);
    }

    /**
     * Identify a person
     * @param {Object} identify - Identify data
     * @returns {Promise<Object>} Response
     */
    async identify(identify) {
        return this.api.identify(identify);
    }

    /**
     * Alias person IDs
     * @param {Object} alias - Alias data
     * @returns {Promise<Object>} Response
     */
    async alias(alias) {
        return this.api.alias(alias);
    }

    /**
     * Get person by distinct ID
     * @param {string} distinctId - Person's distinct ID
     * @returns {Promise<Object>} Person data
     */
    async getPerson(distinctId) {
        return this.api.getPerson(distinctId);
    }

    /**
     * Get persons list with filters
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Persons list
     */
    async getPersons(params = {}) {
        return this.api.getPersons(params);
    }

    /**
     * Update person properties
     * @param {string} distinctId - Person's distinct ID
     * @param {Object} properties - Properties to update
     * @returns {Promise<Object>} Updated person
     */
    async updatePerson(distinctId, properties) {
        return this.api.updatePerson(distinctId, properties);
    }

    /**
     * Delete person
     * @param {string} distinctId - Person's distinct ID
     * @returns {Promise<Object>} Deletion response
     */
    async deletePerson(distinctId) {
        return this.api.deletePerson(distinctId);
    }

    /**
     * Get insights (saved queries)
     * @param {Object} params - Query parameters
     * @returns {Promise<Array>} List of insights
     */
    async getInsights(params = {}) {
        return this.api.getInsights(params);
    }

    /**
     * Get specific insight
     * @param {number} insightId - Insight ID
     * @returns {Promise<Object>} Insight data
     */
    async getInsight(insightId) {
        return this.api.getInsight(insightId);
    }

    /**
     * Create an insight
     * @param {Object} insight - Insight configuration
     * @returns {Promise<Object>} Created insight
     */
    async createInsight(insight) {
        return this.api.createInsight(insight);
    }

    /**
     * Get feature flags
     * @returns {Promise<Array>} List of feature flags
     */
    async getFeatureFlags() {
        return this.api.getFeatureFlags();
    }

    /**
     * Get specific feature flag
     * @param {number} flagId - Feature flag ID
     * @returns {Promise<Object>} Feature flag data
     */
    async getFeatureFlag(flagId) {
        return this.api.getFeatureFlag(flagId);
    }

    /**
     * Create feature flag
     * @param {Object} flag - Feature flag configuration
     * @returns {Promise<Object>} Created feature flag
     */
    async createFeatureFlag(flag) {
        return this.api.createFeatureFlag(flag);
    }

    /**
     * Evaluate feature flags for a person
     * @param {string} distinctId - Person's distinct ID
     * @param {Object} options - Evaluation options
     * @returns {Promise<Object>} Feature flag values
     */
    async evaluateFeatureFlags(distinctId, options = {}) {
        return this.api.evaluateFeatureFlags(distinctId, options);
    }

    /**
     * Get cohorts
     * @returns {Promise<Array>} List of cohorts
     */
    async getCohorts() {
        return this.api.getCohorts();
    }

    /**
     * Get specific cohort
     * @param {number} cohortId - Cohort ID
     * @returns {Promise<Object>} Cohort data
     */
    async getCohort(cohortId) {
        return this.api.getCohort(cohortId);
    }

    /**
     * Create cohort
     * @param {Object} cohort - Cohort configuration
     * @returns {Promise<Object>} Created cohort
     */
    async createCohort(cohort) {
        return this.api.createCohort(cohort);
    }

    /**
     * Get annotations
     * @param {Object} params - Query parameters
     * @returns {Promise<Array>} List of annotations
     */
    async getAnnotations(params = {}) {
        return this.api.getAnnotations(params);
    }

    /**
     * Create annotation
     * @param {Object} annotation - Annotation data
     * @returns {Promise<Object>} Created annotation
     */
    async createAnnotation(annotation) {
        return this.api.createAnnotation(annotation);
    }

    /**
     * Get dashboards
     * @returns {Promise<Array>} List of dashboards
     */
    async getDashboards() {
        return this.api.getDashboards();
    }

    /**
     * Get specific dashboard
     * @param {number} dashboardId - Dashboard ID
     * @returns {Promise<Object>} Dashboard data
     */
    async getDashboard(dashboardId) {
        return this.api.getDashboard(dashboardId);
    }

    /**
     * Get session recordings
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Session recordings
     */
    async getSessionRecordings(params = {}) {
        return this.api.getSessionRecordings(params);
    }

    /**
     * Get specific session recording
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Session recording data
     */
    async getSessionRecording(sessionId) {
        return this.api.getSessionRecording(sessionId);
    }

    /**
     * Get events
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Events list
     */
    async getEvents(params = {}) {
        return this.api.getEvents(params);
    }

    /**
     * Get event definitions
     * @returns {Promise<Array>} Event definitions
     */
    async getEventDefinitions() {
        return this.api.getEventDefinitions();
    }

    /**
     * Get property definitions
     * @returns {Promise<Array>} Property definitions
     */
    async getPropertyDefinitions() {
        return this.api.getPropertyDefinitions();
    }

    /**
     * Test authentication
     * @returns {Promise<Object>} Test result
     */
    async testAuth() {
        try {
            // Try to get insights as a simple auth test
            await this.getInsights({ limit: 1 });
            
            return {
                success: true,
                message: 'Authentication successful'
            };
        } catch (error) {
            return {
                success: false,
                message: `Authentication failed: ${error.message}`,
                error: error
            };
        }
    }
}

module.exports = PostHogIntegration;