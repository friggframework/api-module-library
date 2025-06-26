const { OAuth2Requester, get } = require('@friggframework/core');
const axios = require('axios');

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.subdomain = get(params, 'subdomain', null);
        this.email = get(params, 'email', null);
        this.apiToken = get(params, 'apiToken', null);
        this.clientId = get(params, 'clientId', null);
        this.clientSecret = get(params, 'clientSecret', null);
        this.redirectUri = get(params, 'redirectUri', null);
        
        this.baseUrl = `https://${this.subdomain}.zendesk.com`;
        this.apiUrl = `${this.baseUrl}/api/v2`;
        
        // OAuth2 endpoints
        this.authorizationUri = `${this.baseUrl}/oauth/authorizations/new`;
        this.tokenUri = `${this.baseUrl}/oauth/tokens`;
        
        this.scope = get(params, 'scope', 'read write').replace(/,/g, ' ');

        this.client = axios.create({
            baseURL: this.apiUrl,
        });

        // Add request interceptor for authentication
        this.client.interceptors.request.use((config) => {
            if (this.access_token) {
                // OAuth2 authentication
                config.headers['Authorization'] = `Bearer ${this.access_token}`;
            } else if (this.email && this.apiToken) {
                // API token authentication
                const token = Buffer.from(`${this.email}/token:${this.apiToken}`).toString('base64');
                config.headers['Authorization'] = `Basic ${token}`;
            }
            config.headers['Content-Type'] = 'application/json';
            return config;
        });
    }

    // OAuth2 Methods
    async getAuthorizationUri() {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            scope: this.scope,
            state: Math.random().toString(36).substring(7),
        });

        return `${this.authorizationUri}?${params.toString()}`;
    }

    async getTokenFromCode(code) {
        const data = {
            grant_type: 'authorization_code',
            code: code,
            client_id: this.clientId,
            client_secret: this.clientSecret,
            redirect_uri: this.redirectUri,
            scope: this.scope,
        };

        const response = await axios.post(this.tokenUri, data);
        await this.setTokens(response.data);
        return response.data;
    }

    async refreshAccessToken(refreshToken) {
        const data = {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: this.clientId,
            client_secret: this.clientSecret,
        };

        const response = await axios.post(this.tokenUri, data);
        await this.setTokens(response.data);
        return response.data;
    }

    // Helper method for API requests
    async makeRequest(method, endpoint, data = null, params = null) {
        try {
            const response = await this.client({
                method,
                url: endpoint,
                data,
                params,
            });
            return response.data;
        } catch (error) {
            throw new Error(`Zendesk API Error: ${error.response?.data?.error || error.message}`);
        }
    }

    // Ticket endpoints
    async getTickets(params = {}) {
        return this.makeRequest('GET', '/tickets.json', null, params);
    }

    async getTicket(ticketId, params = {}) {
        return this.makeRequest('GET', `/tickets/${ticketId}.json`, null, params);
    }

    async createTicket(ticket) {
        return this.makeRequest('POST', '/tickets.json', { ticket });
    }

    async updateTicket(ticketId, ticket) {
        return this.makeRequest('PUT', `/tickets/${ticketId}.json`, { ticket });
    }

    async deleteTicket(ticketId) {
        return this.makeRequest('DELETE', `/tickets/${ticketId}.json`);
    }

    async bulkDeleteTickets(ticketIds) {
        const ids = ticketIds.join(',');
        return this.makeRequest('DELETE', `/tickets/destroy_many.json?ids=${ids}`);
    }

    // Ticket comments
    async getTicketComments(ticketId, params = {}) {
        return this.makeRequest('GET', `/tickets/${ticketId}/comments.json`, null, params);
    }

    async addTicketComment(ticketId, comment) {
        const ticket = {
            comment: comment
        };
        return this.makeRequest('PUT', `/tickets/${ticketId}.json`, { ticket });
    }

    // Ticket fields
    async getTicketFields(params = {}) {
        return this.makeRequest('GET', '/ticket_fields.json', null, params);
    }

    async getTicketField(fieldId) {
        return this.makeRequest('GET', `/ticket_fields/${fieldId}.json`);
    }

    async createTicketField(ticketField) {
        return this.makeRequest('POST', '/ticket_fields.json', { ticket_field: ticketField });
    }

    async updateTicketField(fieldId, ticketField) {
        return this.makeRequest('PUT', `/ticket_fields/${fieldId}.json`, { ticket_field: ticketField });
    }

    // User endpoints
    async getUsers(params = {}) {
        return this.makeRequest('GET', '/users.json', null, params);
    }

    async getUser(userId) {
        return this.makeRequest('GET', `/users/${userId}.json`);
    }

    async getCurrentUser() {
        return this.makeRequest('GET', '/users/me.json');
    }

    async createUser(user) {
        return this.makeRequest('POST', '/users.json', { user });
    }

    async createOrUpdateUser(user) {
        return this.makeRequest('POST', '/users/create_or_update.json', { user });
    }

    async updateUser(userId, user) {
        return this.makeRequest('PUT', `/users/${userId}.json`, { user });
    }

    async deleteUser(userId) {
        return this.makeRequest('DELETE', `/users/${userId}.json`);
    }

    async suspendUser(userId) {
        return this.makeRequest('PUT', `/users/${userId}.json`, { 
            user: { suspended: true } 
        });
    }

    async searchUsers(query, params = {}) {
        params.query = query;
        return this.makeRequest('GET', '/users/search.json', null, params);
    }

    // Organization endpoints
    async getOrganizations(params = {}) {
        return this.makeRequest('GET', '/organizations.json', null, params);
    }

    async getOrganization(organizationId) {
        return this.makeRequest('GET', `/organizations/${organizationId}.json`);
    }

    async createOrganization(organization) {
        return this.makeRequest('POST', '/organizations.json', { organization });
    }

    async updateOrganization(organizationId, organization) {
        return this.makeRequest('PUT', `/organizations/${organizationId}.json`, { organization });
    }

    async deleteOrganization(organizationId) {
        return this.makeRequest('DELETE', `/organizations/${organizationId}.json`);
    }

    async searchOrganizations(query, params = {}) {
        return this.makeRequest('GET', '/organizations/autocomplete.json', null, { ...params, name: query });
    }

    // Group endpoints
    async getGroups(params = {}) {
        return this.makeRequest('GET', '/groups.json', null, params);
    }

    async getGroup(groupId) {
        return this.makeRequest('GET', `/groups/${groupId}.json`);
    }

    async createGroup(group) {
        return this.makeRequest('POST', '/groups.json', { group });
    }

    async updateGroup(groupId, group) {
        return this.makeRequest('PUT', `/groups/${groupId}.json`, { group });
    }

    async deleteGroup(groupId) {
        return this.makeRequest('DELETE', `/groups/${groupId}.json`);
    }

    // Brand endpoints
    async getBrands(params = {}) {
        return this.makeRequest('GET', '/brands.json', null, params);
    }

    async getBrand(brandId) {
        return this.makeRequest('GET', `/brands/${brandId}.json`);
    }

    // View endpoints
    async getViews(params = {}) {
        return this.makeRequest('GET', '/views.json', null, params);
    }

    async getView(viewId) {
        return this.makeRequest('GET', `/views/${viewId}.json`);
    }

    async executeView(viewId, params = {}) {
        return this.makeRequest('GET', `/views/${viewId}/tickets.json`, null, params);
    }

    async getViewCount(viewId) {
        return this.makeRequest('GET', `/views/${viewId}/count.json`);
    }

    // Macro endpoints
    async getMacros(params = {}) {
        return this.makeRequest('GET', '/macros.json', null, params);
    }

    async getMacro(macroId) {
        return this.makeRequest('GET', `/macros/${macroId}.json`);
    }

    async applyMacro(ticketId, macroId) {
        return this.makeRequest('PUT', `/tickets/${ticketId}/macros/${macroId}/apply.json`);
    }

    // Automation endpoints
    async getAutomations(params = {}) {
        return this.makeRequest('GET', '/automations.json', null, params);
    }

    async getAutomation(automationId) {
        return this.makeRequest('GET', `/automations/${automationId}.json`);
    }

    // Trigger endpoints
    async getTriggers(params = {}) {
        return this.makeRequest('GET', '/triggers.json', null, params);
    }

    async getTrigger(triggerId) {
        return this.makeRequest('GET', `/triggers/${triggerId}.json`);
    }

    // Search endpoint
    async search(query, params = {}) {
        params.query = query;
        return this.makeRequest('GET', '/search.json', null, params);
    }

    // Satisfaction ratings
    async getSatisfactionRatings(params = {}) {
        return this.makeRequest('GET', '/satisfaction_ratings.json', null, params);
    }

    async getSatisfactionRating(ratingId) {
        return this.makeRequest('GET', `/satisfaction_ratings/${ratingId}.json`);
    }

    // Tags
    async getTags(params = {}) {
        return this.makeRequest('GET', '/tags.json', null, params);
    }

    async setTags(type, id, tags) {
        return this.makeRequest('PUT', `/${type}/${id}/tags.json`, { tags });
    }

    async addTags(type, id, tags) {
        return this.makeRequest('PUT', `/${type}/${id}/tags.json`, { tags, safe_update: true });
    }

    async deleteTags(type, id, tags) {
        return this.makeRequest('DELETE', `/${type}/${id}/tags.json`, { tags });
    }

    // Help Center endpoints
    async getCategories(params = {}) {
        return this.makeRequest('GET', '/help_center/categories.json', null, params);
    }

    async getCategory(categoryId) {
        return this.makeRequest('GET', `/help_center/categories/${categoryId}.json`);
    }

    async createCategory(category) {
        return this.makeRequest('POST', '/help_center/categories.json', { category });
    }

    async getSections(params = {}) {
        return this.makeRequest('GET', '/help_center/sections.json', null, params);
    }

    async getSection(sectionId) {
        return this.makeRequest('GET', `/help_center/sections/${sectionId}.json`);
    }

    async createSection(section) {
        return this.makeRequest('POST', '/help_center/sections.json', { section });
    }

    async getArticles(params = {}) {
        return this.makeRequest('GET', '/help_center/articles.json', null, params);
    }

    async getArticle(articleId) {
        return this.makeRequest('GET', `/help_center/articles/${articleId}.json`);
    }

    async createArticle(article) {
        return this.makeRequest('POST', '/help_center/articles.json', { article });
    }

    async updateArticle(articleId, article) {
        return this.makeRequest('PUT', `/help_center/articles/${articleId}.json`, { article });
    }

    async searchArticles(query, params = {}) {
        params.query = query;
        return this.makeRequest('GET', '/help_center/articles/search.json', null, params);
    }

    // Custom objects
    async getCustomObjects(params = {}) {
        return this.makeRequest('GET', '/custom_objects.json', null, params);
    }

    async getCustomObject(key) {
        return this.makeRequest('GET', `/custom_objects/${key}.json`);
    }

    async getCustomObjectRecords(key, params = {}) {
        return this.makeRequest('GET', `/custom_objects/${key}/records.json`, null, params);
    }

    async createCustomObjectRecord(key, record) {
        return this.makeRequest('POST', `/custom_objects/${key}/records.json`, { record });
    }

    // Webhooks
    async getWebhooks(params = {}) {
        return this.makeRequest('GET', '/webhooks.json', null, params);
    }

    async getWebhook(webhookId) {
        return this.makeRequest('GET', `/webhooks/${webhookId}.json`);
    }

    async createWebhook(webhook) {
        return this.makeRequest('POST', '/webhooks.json', { webhook });
    }

    async updateWebhook(webhookId, webhook) {
        return this.makeRequest('PUT', `/webhooks/${webhookId}.json`, { webhook });
    }

    async deleteWebhook(webhookId) {
        return this.makeRequest('DELETE', `/webhooks/${webhookId}.json`);
    }

    // Webhook signature verification
    verifyWebhookSignature(payload, signature, signingSecret) {
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', signingSecret)
            .update(payload)
            .digest('base64');
        
        return signature === expectedSignature;
    }
}

module.exports = { Api };