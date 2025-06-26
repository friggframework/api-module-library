const { ApiClass } = require('@friggframework/core');

class SegmentApi extends ApiClass {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.segment.io/v1';
        this.publicApiUrl = 'https://api.segmentapis.com/v1beta';
        this.writeKey = params.writeKey;
        
        // Set up basic auth with write key
        if (this.writeKey) {
            this.authHeader = 'Basic ' + Buffer.from(this.writeKey + ':').toString('base64');
        }
    }

    /**
     * Get authorization headers
     * @param {boolean} useBearer - Use bearer token instead of basic auth
     * @param {string} token - Bearer token if using bearer auth
     * @returns {Object} Headers with authorization
     */
    _getAuthHeaders(useBearer = false, token = null) {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (useBearer && token) {
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            headers['Authorization'] = this.authHeader;
        }

        return headers;
    }

    /**
     * Identify a user
     * @param {Object} identify - Identify payload
     * @returns {Promise<Object>} Response
     */
    async identify(identify) {
        const payload = {
            ...identify,
            type: 'identify',
            writeKey: this.writeKey,
            timestamp: identify.timestamp || new Date().toISOString()
        };

        return this._post(`${this.baseUrl}/identify`, payload, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Track an event
     * @param {Object} track - Track payload
     * @returns {Promise<Object>} Response
     */
    async track(track) {
        const payload = {
            ...track,
            type: 'track',
            writeKey: this.writeKey,
            timestamp: track.timestamp || new Date().toISOString()
        };

        return this._post(`${this.baseUrl}/track`, payload, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Record page view
     * @param {Object} page - Page payload
     * @returns {Promise<Object>} Response
     */
    async page(page) {
        const payload = {
            ...page,
            type: 'page',
            writeKey: this.writeKey,
            timestamp: page.timestamp || new Date().toISOString()
        };

        return this._post(`${this.baseUrl}/page`, payload, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Record screen view (mobile)
     * @param {Object} screen - Screen payload
     * @returns {Promise<Object>} Response
     */
    async screen(screen) {
        const payload = {
            ...screen,
            type: 'screen',
            writeKey: this.writeKey,
            timestamp: screen.timestamp || new Date().toISOString()
        };

        return this._post(`${this.baseUrl}/screen`, payload, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Associate user with a group
     * @param {Object} group - Group payload
     * @returns {Promise<Object>} Response
     */
    async group(group) {
        const payload = {
            ...group,
            type: 'group',
            writeKey: this.writeKey,
            timestamp: group.timestamp || new Date().toISOString()
        };

        return this._post(`${this.baseUrl}/group`, payload, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Alias one user ID to another
     * @param {Object} alias - Alias payload
     * @returns {Promise<Object>} Response
     */
    async alias(alias) {
        const payload = {
            ...alias,
            type: 'alias',
            writeKey: this.writeKey,
            timestamp: alias.timestamp || new Date().toISOString()
        };

        return this._post(`${this.baseUrl}/alias`, payload, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Send batch of messages
     * @param {Array} batch - Array of messages
     * @returns {Promise<Object>} Response
     */
    async batch(batch) {
        const messages = batch.map(msg => ({
            ...msg,
            timestamp: msg.timestamp || new Date().toISOString()
        }));

        const payload = {
            batch: messages,
            writeKey: this.writeKey
        };

        return this._post(`${this.baseUrl}/batch`, payload, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Import historical data
     * @param {Array} events - Array of historical events
     * @returns {Promise<Object>} Response
     */
    async import(events) {
        const messages = events.map(event => ({
            ...event,
            timestamp: event.timestamp || new Date().toISOString()
        }));

        const payload = {
            batch: messages,
            writeKey: this.writeKey
        };

        return this._post(`${this.baseUrl}/import`, payload, { 
            headers: this._getAuthHeaders() 
        });
    }

    /**
     * Get tracking plan (requires workspace token)
     * @param {string} workspaceToken - Workspace access token
     * @returns {Promise<Object>} Tracking plan
     */
    async getTrackingPlan(workspaceToken) {
        const url = `${this.publicApiUrl}/tracking-plans`;
        return this._get(url, { 
            headers: this._getAuthHeaders(true, workspaceToken) 
        });
    }

    /**
     * Get sources (requires workspace token)
     * @param {string} workspaceToken - Workspace access token
     * @returns {Promise<Array>} List of sources
     */
    async getSources(workspaceToken) {
        const url = `${this.publicApiUrl}/sources`;
        return this._get(url, { 
            headers: this._getAuthHeaders(true, workspaceToken) 
        });
    }

    /**
     * Get destinations (requires workspace token)
     * @param {string} workspaceToken - Workspace access token
     * @returns {Promise<Array>} List of destinations
     */
    async getDestinations(workspaceToken) {
        const url = `${this.publicApiUrl}/destinations`;
        return this._get(url, { 
            headers: this._getAuthHeaders(true, workspaceToken) 
        });
    }

    /**
     * Delete user data (GDPR)
     * @param {Object} params - Deletion parameters
     * @param {string} workspaceToken - Workspace access token
     * @returns {Promise<Object>} Deletion job
     */
    async deleteUser(params, workspaceToken) {
        const url = `${this.publicApiUrl}/deletion-requests`;
        return this._post(url, params, { 
            headers: this._getAuthHeaders(true, workspaceToken) 
        });
    }

    /**
     * Validate batch payload
     * @param {Array} batch - Batch of messages
     * @returns {Object} Validation result
     */
    validateBatch(batch) {
        const errors = [];
        const maxBatchSize = 500;
        const maxMessageSize = 32 * 1024; // 32KB

        if (!Array.isArray(batch)) {
            errors.push('Batch must be an array');
        } else if (batch.length > maxBatchSize) {
            errors.push(`Batch size exceeds maximum of ${maxBatchSize}`);
        }

        batch.forEach((msg, index) => {
            const msgSize = JSON.stringify(msg).length;
            if (msgSize > maxMessageSize) {
                errors.push(`Message ${index} exceeds maximum size of ${maxMessageSize} bytes`);
            }

            if (!msg.type) {
                errors.push(`Message ${index} missing required field: type`);
            }

            if (!msg.userId && !msg.anonymousId) {
                errors.push(`Message ${index} must have either userId or anonymousId`);
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Format context object with common fields
     * @param {Object} context - Context override
     * @returns {Object} Formatted context
     */
    formatContext(context = {}) {
        return {
            library: {
                name: '@friggframework/api-module-segment',
                version: '1.0.0'
            },
            ...context
        };
    }

    /**
     * Create identify payload with validation
     * @param {Object} params - Identify parameters
     * @returns {Object} Formatted identify payload
     */
    createIdentifyPayload(params) {
        if (!params.userId && !params.anonymousId) {
            throw new Error('Either userId or anonymousId is required');
        }

        return {
            userId: params.userId,
            anonymousId: params.anonymousId,
            traits: params.traits || {},
            context: this.formatContext(params.context),
            timestamp: params.timestamp || new Date().toISOString(),
            integrations: params.integrations || {}
        };
    }

    /**
     * Create track payload with validation
     * @param {Object} params - Track parameters
     * @returns {Object} Formatted track payload
     */
    createTrackPayload(params) {
        if (!params.event) {
            throw new Error('Event name is required');
        }

        if (!params.userId && !params.anonymousId) {
            throw new Error('Either userId or anonymousId is required');
        }

        return {
            userId: params.userId,
            anonymousId: params.anonymousId,
            event: params.event,
            properties: params.properties || {},
            context: this.formatContext(params.context),
            timestamp: params.timestamp || new Date().toISOString(),
            integrations: params.integrations || {}
        };
    }

    /**
     * Create page payload with validation
     * @param {Object} params - Page parameters
     * @returns {Object} Formatted page payload
     */
    createPagePayload(params) {
        if (!params.userId && !params.anonymousId) {
            throw new Error('Either userId or anonymousId is required');
        }

        return {
            userId: params.userId,
            anonymousId: params.anonymousId,
            name: params.name,
            category: params.category,
            properties: params.properties || {},
            context: this.formatContext(params.context),
            timestamp: params.timestamp || new Date().toISOString(),
            integrations: params.integrations || {}
        };
    }

    /**
     * Create group payload with validation
     * @param {Object} params - Group parameters
     * @returns {Object} Formatted group payload
     */
    createGroupPayload(params) {
        if (!params.groupId) {
            throw new Error('Group ID is required');
        }

        if (!params.userId && !params.anonymousId) {
            throw new Error('Either userId or anonymousId is required');
        }

        return {
            userId: params.userId,
            anonymousId: params.anonymousId,
            groupId: params.groupId,
            traits: params.traits || {},
            context: this.formatContext(params.context),
            timestamp: params.timestamp || new Date().toISOString(),
            integrations: params.integrations || {}
        };
    }
}

module.exports = SegmentApi;