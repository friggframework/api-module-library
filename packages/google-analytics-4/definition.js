const { Integration } = require('@friggframework/module-plugin');
const { GoogleOAuth2Manager } = require('./manager');
const ApiClass = require('./api');

class GoogleAnalytics4Integration extends Integration {
    static name = 'Google Analytics 4';
    static category = 'Analytics';
    static catalogDescription = 'Modern web and app analytics platform with advanced tracking capabilities';
    static version = '1.0.0';
    static referenceUrl = 'https://developers.google.com/analytics';
    static apiDocs = 'https://developers.google.com/analytics/devguides/reporting/data/v1';

    /**
     * Constructor for GoogleAnalytics4Integration
     * @param {Object} params
     */
    constructor(params) {
        super(params);
        this.api = new ApiClass(params);
        this.manager = new GoogleOAuth2Manager(params);
    }

    /**
     * Get available Google Analytics 4 properties
     * @returns {Promise<Array>} List of GA4 properties
     */
    async getProperties() {
        return this.api.getProperties();
    }

    /**
     * Run a report for a GA4 property
     * @param {string} propertyId - GA4 property ID
     * @param {Object} reportRequest - Report configuration
     * @returns {Promise<Object>} Report data
     */
    async runReport(propertyId, reportRequest) {
        return this.api.runReport(propertyId, reportRequest);
    }

    /**
     * Run a realtime report for a GA4 property
     * @param {string} propertyId - GA4 property ID
     * @param {Object} reportRequest - Report configuration
     * @returns {Promise<Object>} Realtime report data
     */
    async runRealtimeReport(propertyId, reportRequest) {
        return this.api.runRealtimeReport(propertyId, reportRequest);
    }

    /**
     * Get property metadata
     * @param {string} propertyId - GA4 property ID
     * @returns {Promise<Object>} Property metadata
     */
    async getMetadata(propertyId) {
        return this.api.getMetadata(propertyId);
    }

    /**
     * Batch run reports
     * @param {string} propertyId - GA4 property ID
     * @param {Array} requests - Array of report requests
     * @returns {Promise<Object>} Batch report results
     */
    async batchRunReports(propertyId, requests) {
        return this.api.batchRunReports(propertyId, requests);
    }

    /**
     * Run pivot report
     * @param {string} propertyId - GA4 property ID
     * @param {Object} reportRequest - Pivot report configuration
     * @returns {Promise<Object>} Pivot report data
     */
    async runPivotReport(propertyId, reportRequest) {
        return this.api.runPivotReport(propertyId, reportRequest);
    }

    /**
     * Get list of custom dimensions
     * @param {string} propertyId - GA4 property ID
     * @returns {Promise<Array>} List of custom dimensions
     */
    async getCustomDimensions(propertyId) {
        return this.api.getCustomDimensions(propertyId);
    }

    /**
     * Get list of custom metrics
     * @param {string} propertyId - GA4 property ID
     * @returns {Promise<Array>} List of custom metrics
     */
    async getCustomMetrics(propertyId) {
        return this.api.getCustomMetrics(propertyId);
    }

    /**
     * Test integration by fetching properties
     * @returns {Promise<Object>} Test result
     */
    async testAuth() {
        try {
            const properties = await this.getProperties();
            return {
                success: true,
                message: 'Authentication successful',
                data: {
                    propertiesCount: properties.length
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

module.exports = GoogleAnalytics4Integration;