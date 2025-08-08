const { Integration } = require('@friggframework/module-plugin');
const ApiClass = require('./api');

class MixpanelIntegration extends Integration {
    static name = 'Mixpanel';
    static category = 'Analytics';
    static catalogDescription = 'Product analytics platform for tracking user interactions and behavior';
    static version = '1.0.0';
    static referenceUrl = 'https://mixpanel.com';
    static apiDocs = 'https://developer.mixpanel.com/reference';

    /**
     * Constructor for MixpanelIntegration
     * @param {Object} params - Should include serviceAccountUsername, serviceAccountSecret, and projectToken
     */
    constructor(params) {
        super(params);
        this.api = new ApiClass(params);
    }

    /**
     * Track an event
     * @param {Object} event - Event data
     * @returns {Promise<Object>} Tracking response
     */
    async track(event) {
        return this.api.track(event);
    }

    /**
     * Track multiple events in batch
     * @param {Array} events - Array of event objects
     * @returns {Promise<Object>} Batch tracking response
     */
    async trackBatch(events) {
        return this.api.trackBatch(events);
    }

    /**
     * Update user profile
     * @param {Object} profile - Profile data
     * @returns {Promise<Object>} Profile update response
     */
    async updateProfile(profile) {
        return this.api.updateProfile(profile);
    }

    /**
     * Update multiple profiles in batch
     * @param {Array} profiles - Array of profile objects
     * @returns {Promise<Object>} Batch profile update response
     */
    async updateProfilesBatch(profiles) {
        return this.api.updateProfilesBatch(profiles);
    }

    /**
     * Create or update a group profile
     * @param {Object} group - Group data
     * @returns {Promise<Object>} Group update response
     */
    async updateGroup(group) {
        return this.api.updateGroup(group);
    }

    /**
     * Query JQL (JSON Query Language) for analytics
     * @param {Object} params - JQL query parameters
     * @returns {Promise<Object>} Query results
     */
    async queryJQL(params) {
        return this.api.queryJQL(params);
    }

    /**
     * Get funnel analysis
     * @param {Object} params - Funnel parameters
     * @returns {Promise<Object>} Funnel data
     */
    async getFunnel(params) {
        return this.api.getFunnel(params);
    }

    /**
     * Get retention analysis
     * @param {Object} params - Retention parameters
     * @returns {Promise<Object>} Retention data
     */
    async getRetention(params) {
        return this.api.getRetention(params);
    }

    /**
     * Get insights (saved reports)
     * @param {number} projectId - Project ID
     * @returns {Promise<Array>} List of insights
     */
    async getInsights(projectId) {
        return this.api.getInsights(projectId);
    }

    /**
     * Export raw event data
     * @param {Object} params - Export parameters
     * @returns {Promise<Object>} Export data
     */
    async exportEvents(params) {
        return this.api.exportEvents(params);
    }

    /**
     * Export people profiles
     * @param {Object} params - Export parameters
     * @returns {Promise<Object>} People data
     */
    async exportPeople(params) {
        return this.api.exportPeople(params);
    }

    /**
     * Get project details
     * @param {number} projectId - Project ID
     * @returns {Promise<Object>} Project details
     */
    async getProject(projectId) {
        return this.api.getProject(projectId);
    }

    /**
     * List all projects
     * @returns {Promise<Array>} List of projects
     */
    async listProjects() {
        return this.api.listProjects();
    }

    /**
     * Get cohorts
     * @param {number} projectId - Project ID
     * @returns {Promise<Array>} List of cohorts
     */
    async getCohorts(projectId) {
        return this.api.getCohorts(projectId);
    }

    /**
     * Create a cohort
     * @param {number} projectId - Project ID
     * @param {Object} cohort - Cohort configuration
     * @returns {Promise<Object>} Created cohort
     */
    async createCohort(projectId, cohort) {
        return this.api.createCohort(projectId, cohort);
    }

    /**
     * Get annotations
     * @param {Object} params - Query parameters
     * @returns {Promise<Array>} List of annotations
     */
    async getAnnotations(params) {
        return this.api.getAnnotations(params);
    }

    /**
     * Create an annotation
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
            const projects = await this.listProjects();
            return {
                success: true,
                message: 'Authentication successful',
                data: {
                    projectsCount: projects.length
                }
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

module.exports = MixpanelIntegration;