const { Integration } = require('@friggframework/module-plugin');
const ApiClass = require('./api');

class AmplitudeIntegration extends Integration {
    static name = 'Amplitude';
    static category = 'Analytics';
    static catalogDescription = 'Product analytics platform for understanding user behavior';
    static version = '1.0.0';
    static referenceUrl = 'https://amplitude.com';
    static apiDocs = 'https://www.docs.developers.amplitude.com/analytics/apis/';

    /**
     * Constructor for AmplitudeIntegration
     * @param {Object} params - Should include apiKey and secretKey
     */
    constructor(params) {
        super(params);
        this.api = new ApiClass(params);
    }

    /**
     * Track an event
     * @param {Object} event - Event data
     * @returns {Promise<Object>} Response
     */
    async trackEvent(event) {
        return this.api.trackEvent(event);
    }

    /**
     * Track multiple events
     * @param {Array} events - Array of events
     * @returns {Promise<Object>} Response
     */
    async trackEvents(events) {
        return this.api.trackEvents(events);
    }

    /**
     * Identify user with properties
     * @param {Object} identify - Identify data
     * @returns {Promise<Object>} Response
     */
    async identify(identify) {
        return this.api.identify(identify);
    }

    /**
     * Set user properties
     * @param {Object} userProperties - User properties
     * @returns {Promise<Object>} Response
     */
    async setUserProperties(userProperties) {
        return this.api.setUserProperties(userProperties);
    }

    /**
     * Set group properties
     * @param {Object} groupProperties - Group properties
     * @returns {Promise<Object>} Response
     */
    async setGroupProperties(groupProperties) {
        return this.api.setGroupProperties(groupProperties);
    }

    /**
     * Track revenue
     * @param {Object} revenue - Revenue data
     * @returns {Promise<Object>} Response
     */
    async trackRevenue(revenue) {
        return this.api.trackRevenue(revenue);
    }

    /**
     * Export project data
     * @param {Object} params - Export parameters
     * @returns {Promise<Object>} Export data
     */
    async exportData(params) {
        return this.api.exportData(params);
    }

    /**
     * Get user activity
     * @param {string} userId - User ID
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} User activity
     */
    async getUserActivity(userId, params = {}) {
        return this.api.getUserActivity(userId, params);
    }

    /**
     * Get event segmentation
     * @param {Object} params - Segmentation parameters
     * @returns {Promise<Object>} Segmentation data
     */
    async getEventSegmentation(params) {
        return this.api.getEventSegmentation(params);
    }

    /**
     * Get funnel analysis
     * @param {Object} params - Funnel parameters
     * @returns {Promise<Object>} Funnel data
     */
    async getFunnelAnalysis(params) {
        return this.api.getFunnelAnalysis(params);
    }

    /**
     * Get retention analysis
     * @param {Object} params - Retention parameters
     * @returns {Promise<Object>} Retention data
     */
    async getRetentionAnalysis(params) {
        return this.api.getRetentionAnalysis(params);
    }

    /**
     * Get user composition
     * @param {Object} params - Composition parameters
     * @returns {Promise<Object>} User composition data
     */
    async getUserComposition(params) {
        return this.api.getUserComposition(params);
    }

    /**
     * Search users
     * @param {string} query - Search query
     * @returns {Promise<Array>} User search results
     */
    async searchUsers(query) {
        return this.api.searchUsers(query);
    }

    /**
     * Get cohorts
     * @returns {Promise<Array>} List of cohorts
     */
    async getCohorts() {
        return this.api.getCohorts();
    }

    /**
     * Get cohort members
     * @param {string} cohortId - Cohort ID
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Cohort members
     */
    async getCohortMembers(cohortId, params = {}) {
        return this.api.getCohortMembers(cohortId, params);
    }

    /**
     * Delete user data (GDPR)
     * @param {Object} params - Deletion parameters
     * @returns {Promise<Object>} Deletion job
     */
    async deleteUserData(params) {
        return this.api.deleteUserData(params);
    }

    /**
     * Get charts
     * @returns {Promise<Array>} List of charts
     */
    async getCharts() {
        return this.api.getCharts();
    }

    /**
     * Get chart data
     * @param {string} chartId - Chart ID
     * @returns {Promise<Object>} Chart data
     */
    async getChartData(chartId) {
        return this.api.getChartData(chartId);
    }

    /**
     * Get annotations
     * @returns {Promise<Array>} List of annotations
     */
    async getAnnotations() {
        return this.api.getAnnotations();
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
     * Test authentication
     * @returns {Promise<Object>} Test result
     */
    async testAuth() {
        try {
            // Try to get cohorts as a simple auth test
            await this.getCohorts();
            
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

module.exports = AmplitudeIntegration;