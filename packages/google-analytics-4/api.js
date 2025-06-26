const { ApiClass } = require('@friggframework/core');

class GoogleAnalytics4Api extends ApiClass {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://analyticsdata.googleapis.com';
        this.adminBaseUrl = 'https://analyticsadmin.googleapis.com';
        this.version = 'v1beta';
        this.adminVersion = 'v1alpha';
    }

    /**
     * Get available Google Analytics 4 properties
     * @returns {Promise<Array>} List of GA4 properties
     */
    async getProperties() {
        const url = `${this.adminBaseUrl}/${this.adminVersion}/accountSummaries`;
        const response = await this._get(url);
        
        const properties = [];
        if (response.accountSummaries) {
            for (const account of response.accountSummaries) {
                if (account.propertySummaries) {
                    properties.push(...account.propertySummaries);
                }
            }
        }
        
        return properties;
    }

    /**
     * Run a report for a GA4 property
     * @param {string} propertyId - GA4 property ID (format: properties/123456)
     * @param {Object} reportRequest - Report configuration
     * @returns {Promise<Object>} Report data
     */
    async runReport(propertyId, reportRequest) {
        const url = `${this.baseUrl}/${this.version}/${propertyId}:runReport`;
        return this._post(url, reportRequest);
    }

    /**
     * Run a realtime report for a GA4 property
     * @param {string} propertyId - GA4 property ID
     * @param {Object} reportRequest - Report configuration
     * @returns {Promise<Object>} Realtime report data
     */
    async runRealtimeReport(propertyId, reportRequest) {
        const url = `${this.baseUrl}/${this.version}/${propertyId}:runRealtimeReport`;
        return this._post(url, reportRequest);
    }

    /**
     * Get property metadata
     * @param {string} propertyId - GA4 property ID
     * @returns {Promise<Object>} Property metadata
     */
    async getMetadata(propertyId) {
        const url = `${this.baseUrl}/${this.version}/${propertyId}/metadata`;
        return this._get(url);
    }

    /**
     * Batch run reports
     * @param {string} propertyId - GA4 property ID
     * @param {Array} requests - Array of report requests
     * @returns {Promise<Object>} Batch report results
     */
    async batchRunReports(propertyId, requests) {
        const url = `${this.baseUrl}/${this.version}/${propertyId}:batchRunReports`;
        return this._post(url, { requests });
    }

    /**
     * Run pivot report
     * @param {string} propertyId - GA4 property ID
     * @param {Object} reportRequest - Pivot report configuration
     * @returns {Promise<Object>} Pivot report data
     */
    async runPivotReport(propertyId, reportRequest) {
        const url = `${this.baseUrl}/${this.version}/${propertyId}:runPivotReport`;
        return this._post(url, reportRequest);
    }

    /**
     * Get list of custom dimensions
     * @param {string} propertyId - GA4 property ID
     * @returns {Promise<Array>} List of custom dimensions
     */
    async getCustomDimensions(propertyId) {
        const url = `${this.adminBaseUrl}/${this.adminVersion}/${propertyId}/customDimensions`;
        const response = await this._get(url);
        return response.customDimensions || [];
    }

    /**
     * Get list of custom metrics
     * @param {string} propertyId - GA4 property ID
     * @returns {Promise<Array>} List of custom metrics
     */
    async getCustomMetrics(propertyId) {
        const url = `${this.adminBaseUrl}/${this.adminVersion}/${propertyId}/customMetrics`;
        const response = await this._get(url);
        return response.customMetrics || [];
    }

    /**
     * Create a custom dimension
     * @param {string} propertyId - GA4 property ID
     * @param {Object} dimension - Custom dimension configuration
     * @returns {Promise<Object>} Created custom dimension
     */
    async createCustomDimension(propertyId, dimension) {
        const url = `${this.adminBaseUrl}/${this.adminVersion}/${propertyId}/customDimensions`;
        return this._post(url, dimension);
    }

    /**
     * Create a custom metric
     * @param {string} propertyId - GA4 property ID
     * @param {Object} metric - Custom metric configuration
     * @returns {Promise<Object>} Created custom metric
     */
    async createCustomMetric(propertyId, metric) {
        const url = `${this.adminBaseUrl}/${this.adminVersion}/${propertyId}/customMetrics`;
        return this._post(url, metric);
    }

    /**
     * Get data streams for a property
     * @param {string} propertyId - GA4 property ID
     * @returns {Promise<Array>} List of data streams
     */
    async getDataStreams(propertyId) {
        const url = `${this.adminBaseUrl}/${this.adminVersion}/${propertyId}/dataStreams`;
        const response = await this._get(url);
        return response.dataStreams || [];
    }

    /**
     * Get measurement protocol secret
     * @param {string} dataStreamId - Data stream ID
     * @returns {Promise<Object>} Measurement protocol secrets
     */
    async getMeasurementProtocolSecrets(dataStreamId) {
        const url = `${this.adminBaseUrl}/${this.adminVersion}/${dataStreamId}/measurementProtocolSecrets`;
        const response = await this._get(url);
        return response.measurementProtocolSecrets || [];
    }

    /**
     * Create measurement protocol secret
     * @param {string} dataStreamId - Data stream ID
     * @param {Object} secret - Secret configuration
     * @returns {Promise<Object>} Created secret
     */
    async createMeasurementProtocolSecret(dataStreamId, secret) {
        const url = `${this.adminBaseUrl}/${this.adminVersion}/${dataStreamId}/measurementProtocolSecrets`;
        return this._post(url, secret);
    }

    /**
     * Send event via Measurement Protocol
     * @param {string} measurementId - Measurement ID from data stream
     * @param {string} apiSecret - API secret
     * @param {Object} payload - Event payload
     * @returns {Promise<Object>} Response
     */
    async sendMeasurementProtocolEvent(measurementId, apiSecret, payload) {
        const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
        return this._post(url, payload);
    }

    /**
     * Get audiences for a property
     * @param {string} propertyId - GA4 property ID
     * @returns {Promise<Array>} List of audiences
     */
    async getAudiences(propertyId) {
        const url = `${this.adminBaseUrl}/${this.adminVersion}/${propertyId}/audiences`;
        const response = await this._get(url);
        return response.audiences || [];
    }

    /**
     * Create an audience
     * @param {string} propertyId - GA4 property ID
     * @param {Object} audience - Audience configuration
     * @returns {Promise<Object>} Created audience
     */
    async createAudience(propertyId, audience) {
        const url = `${this.adminBaseUrl}/${this.adminVersion}/${propertyId}/audiences`;
        return this._post(url, audience);
    }

    /**
     * Get conversion events for a property
     * @param {string} propertyId - GA4 property ID
     * @returns {Promise<Array>} List of conversion events
     */
    async getConversionEvents(propertyId) {
        const url = `${this.adminBaseUrl}/${this.adminVersion}/${propertyId}/conversionEvents`;
        const response = await this._get(url);
        return response.conversionEvents || [];
    }

    /**
     * Mark event as conversion
     * @param {string} propertyId - GA4 property ID
     * @param {Object} conversionEvent - Conversion event configuration
     * @returns {Promise<Object>} Created conversion event
     */
    async createConversionEvent(propertyId, conversionEvent) {
        const url = `${this.adminBaseUrl}/${this.adminVersion}/${propertyId}/conversionEvents`;
        return this._post(url, conversionEvent);
    }
}

module.exports = GoogleAnalytics4Api;