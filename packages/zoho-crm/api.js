const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://www.zohoapis.com/crm/v8';

        // OAuth2 configuration  
        this.authorizationUri = 'https://accounts.zoho.com/oauth/v2/auth';
        this.tokenUri = 'https://accounts.zoho.com/oauth/v2/token';
        this.client_id = get(params, 'client_id', process.env.ZOHO_CLIENT_ID);
        this.client_secret = get(params, 'client_secret', process.env.ZOHO_CLIENT_SECRET);
        this.redirect_uri = get(params, 'redirect_uri', process.env.ZOHO_REDIRECT_URI);
        this.scope = get(params, 'scope', 'ZohoCRM.modules.ALL,ZohoCRM.users.ALL');

        this.URLs = {
            // Users endpoints
            users: '/users',
            userById: (userId) => `/users/${userId}`,
            currentUser: '/users?type=CurrentUser',

            // Records endpoints (module-based)
            records: (module) => `/${module}`,
            recordById: (module, recordId) => `/${module}/${recordId}`,
            recordsUpsert: (module) => `/${module}/upsert`,
            recordsDeleted: (module) => `/${module}/deleted`,

            // Common modules
            leads: '/Leads',
            leadById: (leadId) => `/Leads/${leadId}`,
            accounts: '/Accounts',
            accountById: (accountId) => `/Accounts/${accountId}`,
            contacts: '/Contacts',
            contactById: (contactId) => `/Contacts/${contactId}`,
            deals: '/Deals',
            dealById: (dealId) => `/Deals/${dealId}`,
            tasks: '/Tasks',
            taskById: (taskId) => `/Tasks/${taskId}`,
            events: '/Events',
            eventById: (eventId) => `/Events/${eventId}`,
            calls: '/Calls',
            callById: (callId) => `/Calls/${callId}`,

            // Organization and settings
            org: '/org',
            modules: '/settings/modules',
            fields: (module) => `/settings/fields?module=${module}`,
            layouts: (module) => `/settings/layouts?module=${module}`,
            customViews: (module) => `/settings/custom_views?module=${module}`,

            // Search and query
            search: '/search',
            coql: '/coql',

            // Files and attachments
            attachments: (module, recordId) => `/${module}/${recordId}/Attachments`,
            photos: (module, recordId) => `/${module}/${recordId}/photo`,

            // Related records
            relatedRecords: (module, recordId, relatedModule) => `/${module}/${recordId}/${relatedModule}`,
        };
    }

    async getAuthorizationUri() {
        return `${this.authorizationUri}?response_type=code&client_id=${this.client_id}&scope=${this.scope}&redirect_uri=${this.redirect_uri}&access_type=offline`;
    }

    // Users API methods
    async getUsers(options = {}) {
        const query = this._cleanParams({
            type: options.type,
            page: options.page,
            per_page: options.per_page,
            ids: options.ids
        });

        return this._get({
            url: this.baseUrl + this.URLs.users,
            query
        });
    }

    async getUserById(userId) {
        return this._get({
            url: this.baseUrl + this.URLs.userById(userId)
        });
    }

    async getCurrentUser() {
        return this._get({
            url: this.baseUrl + this.URLs.currentUser
        });
    }

    async createUsers(body) {
        return this._post({
            url: this.baseUrl + this.URLs.users,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async updateUsers(body) {
        return this._put({
            url: this.baseUrl + this.URLs.users,
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async updateUser(userId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.userById(userId),
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async deleteUser(userId) {
        return this._delete({
            url: this.baseUrl + this.URLs.userById(userId)
        });
    }

    // Generic Records API methods
    async getRecords(module, options = {}) {
        const query = this._cleanParams({
            approved: options.approved,
            converted: options.converted,
            cvid: options.cvid,
            ids: options.ids,
            uid: options.uid,
            fields: options.fields,
            sort_by: options.sort_by,
            sort_order: options.sort_order,
            page: options.page,
            per_page: options.per_page,
            startDateTime: options.startDateTime,
            endDateTime: options.endDateTime,
            territory_id: options.territory_id,
            include_child: options.include_child,
            page_token: options.page_token
        });

        return this._get({
            url: this.baseUrl + this.URLs.records(module),
            query
        });
    }

    async getRecordById(module, recordId, options = {}) {
        const query = this._cleanParams({
            approved: options.approved,
            converted: options.converted,
            cvid: options.cvid,
            uid: options.uid,
            fields: options.fields,
            startDateTime: options.startDateTime,
            endDateTime: options.endDateTime,
            territory_id: options.territory_id,
            include_child: options.include_child
        });

        return this._get({
            url: this.baseUrl + this.URLs.recordById(module, recordId),
            query
        });
    }

    async createRecords(module, body) {
        return this._post({
            url: this.baseUrl + this.URLs.records(module),
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async updateRecords(module, body) {
        return this._put({
            url: this.baseUrl + this.URLs.records(module),
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async updateRecord(module, recordId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.recordById(module, recordId),
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async upsertRecords(module, body) {
        return this._post({
            url: this.baseUrl + this.URLs.recordsUpsert(module),
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async deleteRecords(module, ids) {
        const query = { ids };
        return this._delete({
            url: this.baseUrl + this.URLs.records(module),
            query
        });
    }

    async deleteRecord(module, recordId) {
        return this._delete({
            url: this.baseUrl + this.URLs.recordById(module, recordId)
        });
    }

    async getDeletedRecords(module, options = {}) {
        const query = this._cleanParams({
            type: options.type,
            page: options.page,
            per_page: options.per_page,
            ids: options.ids
        });

        return this._get({
            url: this.baseUrl + this.URLs.recordsDeleted(module),
            query
        });
    }

    // Leads API methods
    async getLeads(options = {}) {
        return this.getRecords('Leads', options);
    }

    async getLeadById(leadId, options = {}) {
        return this.getRecordById('Leads', leadId, options);
    }

    async createLeads(body) {
        return this.createRecords('Leads', body);
    }

    async updateLeads(body) {
        return this.updateRecords('Leads', body);
    }

    async updateLead(leadId, body) {
        return this.updateRecord('Leads', leadId, body);
    }

    async deleteLeads(ids) {
        return this.deleteRecords('Leads', ids);
    }

    async deleteLead(leadId) {
        return this.deleteRecord('Leads', leadId);
    }

    // Accounts API methods
    async getAccounts(options = {}) {
        return this.getRecords('Accounts', options);
    }

    async getAccountById(accountId, options = {}) {
        return this.getRecordById('Accounts', accountId, options);
    }

    async createAccounts(body) {
        return this.createRecords('Accounts', body);
    }

    async updateAccounts(body) {
        return this.updateRecords('Accounts', body);
    }

    async updateAccount(accountId, body) {
        return this.updateRecord('Accounts', accountId, body);
    }

    async deleteAccounts(ids) {
        return this.deleteRecords('Accounts', ids);
    }

    async deleteAccount(accountId) {
        return this.deleteRecord('Accounts', accountId);
    }

    // Contacts API methods
    async getContacts(options = {}) {
        return this.getRecords('Contacts', options);
    }

    async getContactById(contactId, options = {}) {
        return this.getRecordById('Contacts', contactId, options);
    }

    async createContacts(body) {
        return this.createRecords('Contacts', body);
    }

    async updateContacts(body) {
        return this.updateRecords('Contacts', body);
    }

    async updateContact(contactId, body) {
        return this.updateRecord('Contacts', contactId, body);
    }

    async deleteContacts(ids) {
        return this.deleteRecords('Contacts', ids);
    }

    async deleteContact(contactId) {
        return this.deleteRecord('Contacts', contactId);
    }

    // Deals API methods
    async getDeals(options = {}) {
        return this.getRecords('Deals', options);
    }

    async getDealById(dealId, options = {}) {
        return this.getRecordById('Deals', dealId, options);
    }

    async createDeals(body) {
        return this.createRecords('Deals', body);
    }

    async updateDeals(body) {
        return this.updateRecords('Deals', body);
    }

    async updateDeal(dealId, body) {
        return this.updateRecord('Deals', dealId, body);
    }

    async deleteDeals(ids) {
        return this.deleteRecords('Deals', ids);
    }

    async deleteDeal(dealId) {
        return this.deleteRecord('Deals', dealId);
    }

    // Tasks API methods
    async getTasks(options = {}) {
        return this.getRecords('Tasks', options);
    }

    async getTaskById(taskId, options = {}) {
        return this.getRecordById('Tasks', taskId, options);
    }

    async createTasks(body) {
        return this.createRecords('Tasks', body);
    }

    async updateTasks(body) {
        return this.updateRecords('Tasks', body);
    }

    async updateTask(taskId, body) {
        return this.updateRecord('Tasks', taskId, body);
    }

    async deleteTasks(ids) {
        return this.deleteRecords('Tasks', ids);
    }

    async deleteTask(taskId) {
        return this.deleteRecord('Tasks', taskId);
    }

    // Events API methods
    async getEvents(options = {}) {
        return this.getRecords('Events', options);
    }

    async getEventById(eventId, options = {}) {
        return this.getRecordById('Events', eventId, options);
    }

    async createEvents(body) {
        return this.createRecords('Events', body);
    }

    async updateEvents(body) {
        return this.updateRecords('Events', body);
    }

    async updateEvent(eventId, body) {
        return this.updateRecord('Events', eventId, body);
    }

    async deleteEvents(ids) {
        return this.deleteRecords('Events', ids);
    }

    async deleteEvent(eventId) {
        return this.deleteRecord('Events', eventId);
    }

    // Calls API methods
    async getCalls(options = {}) {
        return this.getRecords('Calls', options);
    }

    async getCallById(callId, options = {}) {
        return this.getRecordById('Calls', callId, options);
    }

    async createCalls(body) {
        return this.createRecords('Calls', body);
    }

    async updateCalls(body) {
        return this.updateRecords('Calls', body);
    }

    async updateCall(callId, body) {
        return this.updateRecord('Calls', callId, body);
    }

    async deleteCalls(ids) {
        return this.deleteRecords('Calls', ids);
    }

    async deleteCall(callId) {
        return this.deleteRecord('Calls', callId);
    }

    // Organization and settings methods
    async getOrganization() {
        return this._get({
            url: this.baseUrl + this.URLs.org
        });
    }

    async getModules() {
        return this._get({
            url: this.baseUrl + this.URLs.modules
        });
    }

    async getFields(module) {
        return this._get({
            url: this.baseUrl + this.URLs.fields(module)
        });
    }

    async getLayouts(module) {
        return this._get({
            url: this.baseUrl + this.URLs.layouts(module)
        });
    }

    async getCustomViews(module) {
        return this._get({
            url: this.baseUrl + this.URLs.customViews(module)
        });
    }

    // Search and query methods
    async search(options = {}) {
        const query = this._cleanParams({
            criteria: options.criteria,
            email: options.email,
            phone: options.phone,
            word: options.word,
            page: options.page,
            per_page: options.per_page
        });

        return this._get({
            url: this.baseUrl + this.URLs.search,
            query
        });
    }

    async coqlQuery(queryString) {
        return this._post({
            url: this.baseUrl + this.URLs.coql,
            body: { select_query: queryString },
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    // Related records methods
    async getRelatedRecords(module, recordId, relatedModule, options = {}) {
        const query = this._cleanParams({
            page: options.page,
            per_page: options.per_page,
            fields: options.fields
        });

        return this._get({
            url: this.baseUrl + this.URLs.relatedRecords(module, recordId, relatedModule),
            query
        });
    }

    async createRelatedRecords(module, recordId, relatedModule, body) {
        return this._post({
            url: this.baseUrl + this.URLs.relatedRecords(module, recordId, relatedModule),
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async updateRelatedRecords(module, recordId, relatedModule, body) {
        return this._put({
            url: this.baseUrl + this.URLs.relatedRecords(module, recordId, relatedModule),
            body,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async deleteRelatedRecords(module, recordId, relatedModule, relatedIds) {
        const query = { ids: relatedIds };
        return this._delete({
            url: this.baseUrl + this.URLs.relatedRecords(module, recordId, relatedModule),
            query
        });
    }

    // Attachments methods
    async getAttachments(module, recordId) {
        return this._get({
            url: this.baseUrl + this.URLs.attachments(module, recordId)
        });
    }

    async uploadAttachment(module, recordId, file) {
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('file', file);

        return this._post({
            url: this.baseUrl + this.URLs.attachments(module, recordId),
            body: formData,
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    }

    // Helper methods
    _cleanParams(params) {
        const cleaned = {};
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                cleaned[key] = params[key];
            }
        });
        return cleaned;
    }

    // Legacy compatibility methods (for existing code)
    async listUsers(options = {}) {
        return this.getUsers(options);
    }

    async find(module, options = {}) {
        return this.getRecords(module, options);
    }

    async findById(module, recordId, options = {}) {
        return this.getRecordById(module, recordId, options);
    }

    async create(module, body) {
        return this.createRecords(module, body);
    }

    async update(module, body) {
        return this.updateRecords(module, body);
    }

    async delete(module, ids) {
        return this.deleteRecords(module, ids);
    }
}

module.exports = { Api };
