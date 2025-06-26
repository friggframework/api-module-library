const { Requester, get } = require('@friggframework/core');
const axios = require('axios');

class Api extends Requester {
    constructor(params = {}) {
        super(params);

        this.subdomain = get(params, 'subdomain', null);
        this.apiKey = get(params, 'apiKey', null);
        
        this.baseUrl = `https://${this.subdomain}.freshdesk.com/api/v2`;
        
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
            },
            auth: {
                username: this.apiKey,
                password: 'X', // Freshdesk requires 'X' as password for API key auth
            },
        });
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
            throw new Error(`Freshdesk API Error: ${error.response?.data?.description || error.message}`);
        }
    }

    // Paginated request helper
    async makePaginatedRequest(endpoint, params = {}) {
        const results = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const response = await this.makeRequest('GET', endpoint, null, { ...params, page });
            
            if (Array.isArray(response)) {
                results.push(...response);
                hasMore = response.length === 100; // Freshdesk returns max 100 per page
            } else {
                results.push(...response.results || [response]);
                hasMore = false;
            }
            
            page++;
        }

        return results;
    }

    // Ticket endpoints
    async getTickets(params = {}) {
        return this.makeRequest('GET', '/tickets', null, params);
    }

    async getTicket(ticketId, params = {}) {
        return this.makeRequest('GET', `/tickets/${ticketId}`, null, params);
    }

    async createTicket(ticket) {
        return this.makeRequest('POST', '/tickets', ticket);
    }

    async updateTicket(ticketId, ticket) {
        return this.makeRequest('PUT', `/tickets/${ticketId}`, ticket);
    }

    async deleteTicket(ticketId) {
        return this.makeRequest('DELETE', `/tickets/${ticketId}`);
    }

    async restoreTicket(ticketId) {
        return this.makeRequest('PUT', `/tickets/${ticketId}/restore`);
    }

    // Ticket fields
    async getTicketFields() {
        return this.makeRequest('GET', '/ticket_fields');
    }

    async getTicketField(fieldId) {
        return this.makeRequest('GET', `/ticket_fields/${fieldId}`);
    }

    async createTicketField(field) {
        return this.makeRequest('POST', '/admin/ticket_fields', field);
    }

    async updateTicketField(fieldId, field) {
        return this.makeRequest('PUT', `/admin/ticket_fields/${fieldId}`, field);
    }

    // Ticket conversations
    async getTicketConversations(ticketId) {
        return this.makeRequest('GET', `/tickets/${ticketId}/conversations`);
    }

    async createReply(ticketId, reply) {
        return this.makeRequest('POST', `/tickets/${ticketId}/reply`, reply);
    }

    async createNote(ticketId, note) {
        return this.makeRequest('POST', `/tickets/${ticketId}/notes`, note);
    }

    // Ticket activities
    async getTicketActivities(ticketId) {
        return this.makeRequest('GET', `/tickets/${ticketId}/activities`);
    }

    // Contact endpoints
    async getContacts(params = {}) {
        return this.makeRequest('GET', '/contacts', null, params);
    }

    async getContact(contactId) {
        return this.makeRequest('GET', `/contacts/${contactId}`);
    }

    async createContact(contact) {
        return this.makeRequest('POST', '/contacts', contact);
    }

    async updateContact(contactId, contact) {
        return this.makeRequest('PUT', `/contacts/${contactId}`, contact);
    }

    async deleteContact(contactId) {
        return this.makeRequest('DELETE', `/contacts/${contactId}`);
    }

    async searchContacts(query) {
        return this.makeRequest('GET', '/search/contacts', null, { query });
    }

    async makeAgent(contactId) {
        return this.makeRequest('PUT', `/contacts/${contactId}/make_agent`);
    }

    // Contact fields
    async getContactFields() {
        return this.makeRequest('GET', '/contact_fields');
    }

    // Agent endpoints
    async getAgents(params = {}) {
        return this.makeRequest('GET', '/agents', null, params);
    }

    async getAgent(agentId) {
        return this.makeRequest('GET', `/agents/${agentId}`);
    }

    async getCurrentAgent() {
        return this.makeRequest('GET', '/agents/me');
    }

    async updateAgent(agentId, agent) {
        return this.makeRequest('PUT', `/agents/${agentId}`, agent);
    }

    async deleteAgent(agentId) {
        return this.makeRequest('DELETE', `/agents/${agentId}`);
    }

    // Company endpoints
    async getCompanies(params = {}) {
        return this.makeRequest('GET', '/companies', null, params);
    }

    async getCompany(companyId) {
        return this.makeRequest('GET', `/companies/${companyId}`);
    }

    async createCompany(company) {
        return this.makeRequest('POST', '/companies', company);
    }

    async updateCompany(companyId, company) {
        return this.makeRequest('PUT', `/companies/${companyId}`, company);
    }

    async deleteCompany(companyId) {
        return this.makeRequest('DELETE', `/companies/${companyId}`);
    }

    async searchCompanies(query) {
        return this.makeRequest('GET', '/search/companies', null, { query });
    }

    // Company fields
    async getCompanyFields() {
        return this.makeRequest('GET', '/company_fields');
    }

    // Group endpoints
    async getGroups(params = {}) {
        return this.makeRequest('GET', '/groups', null, params);
    }

    async getGroup(groupId) {
        return this.makeRequest('GET', `/groups/${groupId}`);
    }

    async createGroup(group) {
        return this.makeRequest('POST', '/groups', group);
    }

    async updateGroup(groupId, group) {
        return this.makeRequest('PUT', `/groups/${groupId}`, group);
    }

    async deleteGroup(groupId) {
        return this.makeRequest('DELETE', `/groups/${groupId}`);
    }

    // Product endpoints
    async getProducts(params = {}) {
        return this.makeRequest('GET', '/products', null, params);
    }

    async getProduct(productId) {
        return this.makeRequest('GET', `/products/${productId}`);
    }

    async createProduct(product) {
        return this.makeRequest('POST', '/products', product);
    }

    async updateProduct(productId, product) {
        return this.makeRequest('PUT', `/products/${productId}`, product);
    }

    async deleteProduct(productId) {
        return this.makeRequest('DELETE', `/products/${productId}`);
    }

    // Time entry endpoints
    async getTimeEntries(params = {}) {
        return this.makeRequest('GET', '/time_entries', null, params);
    }

    async createTimeEntry(ticketId, timeEntry) {
        return this.makeRequest('POST', `/tickets/${ticketId}/time_entries`, timeEntry);
    }

    async updateTimeEntry(timeEntryId, timeEntry) {
        return this.makeRequest('PUT', `/time_entries/${timeEntryId}`, timeEntry);
    }

    async deleteTimeEntry(timeEntryId) {
        return this.makeRequest('DELETE', `/time_entries/${timeEntryId}`);
    }

    // Solution (Knowledge Base) endpoints
    async getSolutionCategories(params = {}) {
        return this.makeRequest('GET', '/solutions/categories', null, params);
    }

    async getSolutionCategory(categoryId) {
        return this.makeRequest('GET', `/solutions/categories/${categoryId}`);
    }

    async createSolutionCategory(category) {
        return this.makeRequest('POST', '/solutions/categories', category);
    }

    async updateSolutionCategory(categoryId, category) {
        return this.makeRequest('PUT', `/solutions/categories/${categoryId}`, category);
    }

    async deleteSolutionCategory(categoryId) {
        return this.makeRequest('DELETE', `/solutions/categories/${categoryId}`);
    }

    async getSolutionFolders(categoryId, params = {}) {
        return this.makeRequest('GET', `/solutions/categories/${categoryId}/folders`, null, params);
    }

    async getSolutionFolder(folderId) {
        return this.makeRequest('GET', `/solutions/folders/${folderId}`);
    }

    async createSolutionFolder(categoryId, folder) {
        return this.makeRequest('POST', `/solutions/categories/${categoryId}/folders`, folder);
    }

    async updateSolutionFolder(folderId, folder) {
        return this.makeRequest('PUT', `/solutions/folders/${folderId}`, folder);
    }

    async deleteSolutionFolder(folderId) {
        return this.makeRequest('DELETE', `/solutions/folders/${folderId}`);
    }

    async getSolutionArticles(folderId, params = {}) {
        return this.makeRequest('GET', `/solutions/folders/${folderId}/articles`, null, params);
    }

    async getSolutionArticle(articleId) {
        return this.makeRequest('GET', `/solutions/articles/${articleId}`);
    }

    async createSolutionArticle(folderId, article) {
        return this.makeRequest('POST', `/solutions/folders/${folderId}/articles`, article);
    }

    async updateSolutionArticle(articleId, article) {
        return this.makeRequest('PUT', `/solutions/articles/${articleId}`, article);
    }

    async deleteSolutionArticle(articleId) {
        return this.makeRequest('DELETE', `/solutions/articles/${articleId}`);
    }

    async searchSolutionArticles(term) {
        return this.makeRequest('GET', '/search/solutions', null, { term });
    }

    // Forum endpoints
    async getForumCategories(params = {}) {
        return this.makeRequest('GET', '/discussions/categories', null, params);
    }

    async getForumCategory(categoryId) {
        return this.makeRequest('GET', `/discussions/categories/${categoryId}`);
    }

    async createForumCategory(category) {
        return this.makeRequest('POST', '/discussions/categories', category);
    }

    async getForums(categoryId, params = {}) {
        return this.makeRequest('GET', `/discussions/categories/${categoryId}/forums`, null, params);
    }

    async getForum(forumId) {
        return this.makeRequest('GET', `/discussions/forums/${forumId}`);
    }

    async createForum(categoryId, forum) {
        return this.makeRequest('POST', `/discussions/categories/${categoryId}/forums`, forum);
    }

    async getTopics(forumId, params = {}) {
        return this.makeRequest('GET', `/discussions/forums/${forumId}/topics`, null, params);
    }

    async getTopic(topicId) {
        return this.makeRequest('GET', `/discussions/topics/${topicId}`);
    }

    async createTopic(forumId, topic) {
        return this.makeRequest('POST', `/discussions/forums/${forumId}/topics`, topic);
    }

    // Email config endpoints
    async getEmailConfigs() {
        return this.makeRequest('GET', '/email_configs');
    }

    async getEmailConfig(emailConfigId) {
        return this.makeRequest('GET', `/email_configs/${emailConfigId}`);
    }

    // Automation endpoints
    async getAutomationRules(params = {}) {
        return this.makeRequest('GET', '/automation_rules', null, params);
    }

    async getAutomationRule(ruleId) {
        return this.makeRequest('GET', `/automation_rules/${ruleId}`);
    }

    // SLA Policy endpoints
    async getSLAPolicies() {
        return this.makeRequest('GET', '/sla_policies');
    }

    async getSLAPolicy(policyId) {
        return this.makeRequest('GET', `/sla_policies/${policyId}`);
    }

    // Business Hours endpoints
    async getBusinessHours() {
        return this.makeRequest('GET', '/business_hours');
    }

    async getBusinessHour(businessHourId) {
        return this.makeRequest('GET', `/business_hours/${businessHourId}`);
    }

    // Canned Response endpoints
    async getCannedResponses(params = {}) {
        return this.makeRequest('GET', '/canned_responses', null, params);
    }

    async getCannedResponse(responseId) {
        return this.makeRequest('GET', `/canned_responses/${responseId}`);
    }

    async createCannedResponse(response) {
        return this.makeRequest('POST', '/canned_responses', response);
    }

    async updateCannedResponse(responseId, response) {
        return this.makeRequest('PUT', `/canned_responses/${responseId}`, response);
    }

    async deleteCannedResponse(responseId) {
        return this.makeRequest('DELETE', `/canned_responses/${responseId}`);
    }

    // Search endpoints
    async searchTickets(query) {
        return this.makeRequest('GET', '/search/tickets', null, { query });
    }

    // Webhook signature verification
    verifyWebhookSignature(payload, signature, secret) {
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
        
        return signature === expectedSignature;
    }

    // Settings endpoints
    async getSettings() {
        return this.makeRequest('GET', '/settings/helpdesk');
    }

    // Role endpoints
    async getRoles() {
        return this.makeRequest('GET', '/roles');
    }

    async getRole(roleId) {
        return this.makeRequest('GET', `/roles/${roleId}`);
    }

    // Satisfaction rating endpoints
    async getSatisfactionRatings(params = {}) {
        return this.makeRequest('GET', '/surveys/satisfaction_ratings', null, params);
    }

    async createSatisfactionRating(ticketId, rating) {
        return this.makeRequest('POST', `/tickets/${ticketId}/satisfaction_ratings`, rating);
    }
}

module.exports = { Api };