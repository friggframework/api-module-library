const { Integration } = require('@friggframework/module-plugin');
const ApiClass = require('./api');

class SegmentIntegration extends Integration {
    static name = 'Segment';
    static category = 'Analytics';
    static catalogDescription = 'Customer data platform for collecting, cleaning, and routing analytics data';
    static version = '1.0.0';
    static referenceUrl = 'https://segment.com';
    static apiDocs = 'https://segment.com/docs/connections/sources/catalog/libraries/server/http-api/';

    /**
     * Constructor for SegmentIntegration
     * @param {Object} params - Should include writeKey for authentication
     */
    constructor(params) {
        super(params);
        this.api = new ApiClass(params);
    }

    /**
     * Identify a user
     * @param {Object} identify - Identify payload
     * @returns {Promise<Object>} Response
     */
    async identify(identify) {
        return this.api.identify(identify);
    }

    /**
     * Track an event
     * @param {Object} track - Track payload
     * @returns {Promise<Object>} Response
     */
    async track(track) {
        return this.api.track(track);
    }

    /**
     * Record page view
     * @param {Object} page - Page payload
     * @returns {Promise<Object>} Response
     */
    async page(page) {
        return this.api.page(page);
    }

    /**
     * Record screen view (mobile)
     * @param {Object} screen - Screen payload
     * @returns {Promise<Object>} Response
     */
    async screen(screen) {
        return this.api.screen(screen);
    }

    /**
     * Associate user with a group
     * @param {Object} group - Group payload
     * @returns {Promise<Object>} Response
     */
    async group(group) {
        return this.api.group(group);
    }

    /**
     * Alias one user ID to another
     * @param {Object} alias - Alias payload
     * @returns {Promise<Object>} Response
     */
    async alias(alias) {
        return this.api.alias(alias);
    }

    /**
     * Send batch of messages
     * @param {Array} batch - Array of messages
     * @returns {Promise<Object>} Response
     */
    async batch(batch) {
        return this.api.batch(batch);
    }

    /**
     * Import historical data
     * @param {Array} events - Array of historical events
     * @returns {Promise<Object>} Response
     */
    async import(events) {
        return this.api.import(events);
    }

    /**
     * Get tracking plan (requires workspace token)
     * @param {string} workspaceToken - Workspace access token
     * @returns {Promise<Object>} Tracking plan
     */
    async getTrackingPlan(workspaceToken) {
        return this.api.getTrackingPlan(workspaceToken);
    }

    /**
     * Get sources (requires workspace token)
     * @param {string} workspaceToken - Workspace access token
     * @returns {Promise<Array>} List of sources
     */
    async getSources(workspaceToken) {
        return this.api.getSources(workspaceToken);
    }

    /**
     * Get destinations (requires workspace token)
     * @param {string} workspaceToken - Workspace access token
     * @returns {Promise<Array>} List of destinations
     */
    async getDestinations(workspaceToken) {
        return this.api.getDestinations(workspaceToken);
    }

    /**
     * Delete user data (GDPR)
     * @param {Object} params - Deletion parameters
     * @param {string} workspaceToken - Workspace access token
     * @returns {Promise<Object>} Deletion job
     */
    async deleteUser(params, workspaceToken) {
        return this.api.deleteUser(params, workspaceToken);
    }

    /**
     * Test authentication by sending a test event
     * @returns {Promise<Object>} Test result
     */
    async testAuth() {
        try {
            await this.track({
                userId: 'test-user',
                event: 'Test Event',
                properties: {
                    test: true,
                    timestamp: new Date().toISOString()
                }
            });
            
            return {
                success: true,
                message: 'Authentication successful - test event sent'
            };
        } catch (error) {
            return {
                success: false,
                message: `Authentication failed: ${error.message}`,
                error: error
            };
        }
    }

    /**
     * Helper to create identify call with common patterns
     * @param {string} userId - User ID
     * @param {Object} traits - User traits
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response
     */
    async identifyUser(userId, traits, options = {}) {
        return this.identify({
            userId,
            traits,
            timestamp: new Date().toISOString(),
            ...options
        });
    }

    /**
     * Helper to track event with common patterns
     * @param {string} userId - User ID
     * @param {string} event - Event name
     * @param {Object} properties - Event properties
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response
     */
    async trackEvent(userId, event, properties = {}, options = {}) {
        return this.track({
            userId,
            event,
            properties,
            timestamp: new Date().toISOString(),
            ...options
        });
    }

    /**
     * Helper to track page view
     * @param {string} userId - User ID
     * @param {string} name - Page name
     * @param {Object} properties - Page properties
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Response
     */
    async trackPage(userId, name, properties = {}, options = {}) {
        return this.page({
            userId,
            name,
            properties,
            timestamp: new Date().toISOString(),
            ...options
        });
    }

    /**
     * Helper for e-commerce order completed event
     * @param {string} userId - User ID
     * @param {Object} order - Order details
     * @returns {Promise<Object>} Response
     */
    async trackOrderCompleted(userId, order) {
        return this.track({
            userId,
            event: 'Order Completed',
            properties: {
                order_id: order.orderId,
                total: order.total,
                revenue: order.revenue || order.total,
                shipping: order.shipping || 0,
                tax: order.tax || 0,
                discount: order.discount || 0,
                coupon: order.coupon,
                currency: order.currency || 'USD',
                products: order.products || []
            },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Helper for product viewed event
     * @param {string} userId - User ID
     * @param {Object} product - Product details
     * @returns {Promise<Object>} Response
     */
    async trackProductViewed(userId, product) {
        return this.track({
            userId,
            event: 'Product Viewed',
            properties: {
                product_id: product.productId,
                sku: product.sku,
                category: product.category,
                name: product.name,
                brand: product.brand,
                variant: product.variant,
                price: product.price,
                quantity: product.quantity || 1,
                currency: product.currency || 'USD',
                position: product.position,
                url: product.url,
                image_url: product.imageUrl
            },
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = SegmentIntegration;