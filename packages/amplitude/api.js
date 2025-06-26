const { ApiClass } = require('@friggframework/core');

class AmplitudeApi extends ApiClass {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api2.amplitude.com';
        this.apiKey = params.apiKey;
        this.secretKey = params.secretKey;
        
        // Set up basic auth for API endpoints that require it
        if (this.apiKey && this.secretKey) {
            this.authHeader = 'Basic ' + Buffer.from(
                `${this.apiKey}:${this.secretKey}`
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
            'Content-Type': 'application/json'
        };
    }

    /**
     * Track a single event
     * @param {Object} event - Event data
     * @returns {Promise<Object>} Response
     */
    async trackEvent(event) {
        const eventData = {
            api_key: this.apiKey,
            events: [{
                user_id: event.user_id,
                device_id: event.device_id,
                event_type: event.event_type,
                time: event.time || Date.now(),
                event_properties: event.event_properties || {},
                user_properties: event.user_properties || {},
                groups: event.groups || {},
                app_version: event.app_version,
                platform: event.platform,
                os_name: event.os_name,
                os_version: event.os_version,
                device_brand: event.device_brand,
                device_manufacturer: event.device_manufacturer,
                device_model: event.device_model,
                carrier: event.carrier,
                country: event.country,
                region: event.region,
                city: event.city,
                dma: event.dma,
                language: event.language,
                price: event.price,
                quantity: event.quantity,
                revenue: event.revenue,
                productId: event.productId,
                revenueType: event.revenueType,
                location_lat: event.location_lat,
                location_lng: event.location_lng,
                ip: event.ip,
                idfa: event.idfa,
                idfv: event.idfv,
                adid: event.adid,
                android_id: event.android_id,
                event_id: event.event_id,
                session_id: event.session_id,
                insert_id: event.insert_id
            }]
        };

        const url = `${this.baseUrl}/2/httpapi`;
        return this._post(url, eventData);
    }

    /**
     * Track multiple events
     * @param {Array} events - Array of events
     * @returns {Promise<Object>} Response
     */
    async trackEvents(events) {
        const eventData = {
            api_key: this.apiKey,
            events: events.map(event => ({
                user_id: event.user_id,
                device_id: event.device_id,
                event_type: event.event_type,
                time: event.time || Date.now(),
                event_properties: event.event_properties || {},
                user_properties: event.user_properties || {},
                groups: event.groups || {},
                ...event
            }))
        };

        const url = `${this.baseUrl}/2/httpapi`;
        return this._post(url, eventData);
    }

    /**
     * Identify user with properties
     * @param {Object} identify - Identify data
     * @returns {Promise<Object>} Response
     */
    async identify(identify) {
        const identifyData = {
            api_key: this.apiKey,
            identification: [{
                user_id: identify.user_id,
                device_id: identify.device_id,
                user_properties: identify.user_properties || {}
            }]
        };

        const url = `${this.baseUrl}/identify`;
        return this._post(url, identifyData);
    }

    /**
     * Set user properties
     * @param {Object} userProperties - User properties data
     * @returns {Promise<Object>} Response
     */
    async setUserProperties(userProperties) {
        return this.identify({
            user_id: userProperties.user_id,
            device_id: userProperties.device_id,
            user_properties: userProperties.properties
        });
    }

    /**
     * Set group properties
     * @param {Object} groupProperties - Group properties data
     * @returns {Promise<Object>} Response
     */
    async setGroupProperties(groupProperties) {
        const groupData = {
            api_key: this.apiKey,
            identification: [{
                group_type: groupProperties.group_type,
                group_name: groupProperties.group_name,
                group_properties: groupProperties.group_properties || {}
            }]
        };

        const url = `${this.baseUrl}/groupidentify`;
        return this._post(url, groupData);
    }

    /**
     * Track revenue
     * @param {Object} revenue - Revenue data
     * @returns {Promise<Object>} Response
     */
    async trackRevenue(revenue) {
        const revenueEvent = {
            user_id: revenue.user_id,
            device_id: revenue.device_id,
            event_type: revenue.event_type || 'revenue',
            event_properties: {
                ...revenue.event_properties,
                revenue: revenue.revenue,
                price: revenue.price,
                quantity: revenue.quantity || 1,
                productId: revenue.productId,
                revenueType: revenue.revenueType
            }
        };

        return this.trackEvent(revenueEvent);
    }

    /**
     * Export project data
     * @param {Object} params - Export parameters
     * @returns {Promise<Object>} Export data stream
     */
    async exportData(params) {
        const url = 'https://amplitude.com/api/2/export';
        const queryParams = new URLSearchParams({
            start: params.start,
            end: params.end
        }).toString();

        return this._get(`${url}?${queryParams}`, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Get user activity
     * @param {string} userId - User ID
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} User activity
     */
    async getUserActivity(userId, params = {}) {
        const url = 'https://amplitude.com/api/2/useractivity';
        const queryParams = new URLSearchParams({
            user: userId,
            ...params
        }).toString();

        return this._get(`${url}?${queryParams}`, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Get event segmentation
     * @param {Object} params - Segmentation parameters
     * @returns {Promise<Object>} Segmentation data
     */
    async getEventSegmentation(params) {
        const url = 'https://amplitude.com/api/2/events/segmentation';
        const queryParams = new URLSearchParams({
            e: JSON.stringify(params.events || {}),
            start: params.start,
            end: params.end,
            ...params
        }).toString();

        return this._get(`${url}?${queryParams}`, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Get funnel analysis
     * @param {Object} params - Funnel parameters
     * @returns {Promise<Object>} Funnel data
     */
    async getFunnelAnalysis(params) {
        const url = 'https://amplitude.com/api/2/funnels';
        const queryParams = new URLSearchParams({
            e: JSON.stringify(params.events || []),
            start: params.start,
            end: params.end,
            mode: params.mode || 'unordered',
            ...params
        }).toString();

        return this._get(`${url}?${queryParams}`, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Get retention analysis
     * @param {Object} params - Retention parameters
     * @returns {Promise<Object>} Retention data
     */
    async getRetentionAnalysis(params) {
        const url = 'https://amplitude.com/api/2/retention';
        const queryParams = new URLSearchParams({
            se: JSON.stringify(params.start_event || {}),
            re: JSON.stringify(params.return_event || {}),
            start: params.start,
            end: params.end,
            ...params
        }).toString();

        return this._get(`${url}?${queryParams}`, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Get user composition
     * @param {Object} params - Composition parameters
     * @returns {Promise<Object>} User composition data
     */
    async getUserComposition(params) {
        const url = 'https://amplitude.com/api/2/composition';
        const queryParams = new URLSearchParams({
            start: params.start,
            end: params.end,
            p: params.property,
            ...params
        }).toString();

        return this._get(`${url}?${queryParams}`, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Search users
     * @param {string} query - Search query
     * @returns {Promise<Array>} User search results
     */
    async searchUsers(query) {
        const url = 'https://amplitude.com/api/2/usersearch';
        const queryParams = new URLSearchParams({ user: query }).toString();

        return this._get(`${url}?${queryParams}`, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Get cohorts
     * @returns {Promise<Array>} List of cohorts
     */
    async getCohorts() {
        const url = 'https://amplitude.com/api/3/cohorts';
        return this._get(url, { headers: this._getAuthHeaders() });
    }

    /**
     * Get cohort members
     * @param {string} cohortId - Cohort ID
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Cohort members
     */
    async getCohortMembers(cohortId, params = {}) {
        const url = `https://amplitude.com/api/5/cohorts/${cohortId}`;
        const queryParams = new URLSearchParams({
            props: params.props || 0,
            propKeys: params.propKeys || [],
            ...params
        }).toString();

        return this._get(`${url}?${queryParams}`, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Delete user data (GDPR)
     * @param {Object} params - Deletion parameters
     * @returns {Promise<Object>} Deletion job
     */
    async deleteUserData(params) {
        const url = 'https://amplitude.com/api/2/deletions/users';
        const data = {
            user_ids: params.user_ids || [],
            requester: params.requester
        };

        return this._post(url, data, { headers: this._getAuthHeaders() });
    }

    /**
     * Get charts
     * @returns {Promise<Array>} List of charts
     */
    async getCharts() {
        const url = 'https://amplitude.com/api/3/chart/list';
        return this._get(url, { headers: this._getAuthHeaders() });
    }

    /**
     * Get chart data
     * @param {string} chartId - Chart ID
     * @returns {Promise<Object>} Chart data
     */
    async getChartData(chartId) {
        const url = `https://amplitude.com/api/3/chart/${chartId}/query`;
        return this._get(url, { headers: this._getAuthHeaders() });
    }

    /**
     * Get annotations
     * @returns {Promise<Array>} List of annotations
     */
    async getAnnotations() {
        const url = 'https://amplitude.com/api/2/annotations';
        return this._get(url, { headers: this._getAuthHeaders() });
    }

    /**
     * Create annotation
     * @param {Object} annotation - Annotation data
     * @returns {Promise<Object>} Created annotation
     */
    async createAnnotation(annotation) {
        const url = 'https://amplitude.com/api/2/annotations';
        return this._post(url, annotation, { headers: this._getAuthHeaders() });
    }

    /**
     * Update annotation
     * @param {string} annotationId - Annotation ID
     * @param {Object} annotation - Updated annotation data
     * @returns {Promise<Object>} Updated annotation
     */
    async updateAnnotation(annotationId, annotation) {
        const url = `https://amplitude.com/api/2/annotations/${annotationId}`;
        return this._put(url, annotation, { headers: this._getAuthHeaders() });
    }

    /**
     * Delete annotation
     * @param {string} annotationId - Annotation ID
     * @returns {Promise<Object>} Deletion response
     */
    async deleteAnnotation(annotationId) {
        const url = `https://amplitude.com/api/2/annotations/${annotationId}`;
        return this._delete(url, { headers: this._getAuthHeaders() });
    }

    /**
     * Get releases
     * @returns {Promise<Array>} List of releases
     */
    async getReleases() {
        const url = 'https://amplitude.com/api/2/release';
        return this._get(url, { headers: this._getAuthHeaders() });
    }

    /**
     * Create release
     * @param {Object} release - Release data
     * @returns {Promise<Object>} Created release
     */
    async createRelease(release) {
        const url = 'https://amplitude.com/api/2/release';
        return this._post(url, release, { headers: this._getAuthHeaders() });
    }

    /**
     * Helper to format event for common patterns
     * @param {string} userId - User ID
     * @param {string} eventType - Event type
     * @param {Object} properties - Event properties
     * @returns {Object} Formatted event
     */
    formatEvent(userId, eventType, properties = {}) {
        return {
            user_id: userId,
            event_type: eventType,
            event_properties: properties,
            time: Date.now()
        };
    }
}

module.exports = AmplitudeApi;