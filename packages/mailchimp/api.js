const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.server_prefix = get(params, 'server_prefix', null);
        this.baseUrl = this.server_prefix ? `https://${this.server_prefix}.api.mailchimp.com/3.0` : null;
        
        this.URLs = {
            authorization: '/oauth2/authorize',
            access_token: '/oauth2/token',
            
            // Account
            account: '',
            
            // Lists
            lists: '/lists',
            listById: (listId) => `/lists/${listId}`,
            listMembers: (listId) => `/lists/${listId}/members`,
            listMemberById: (listId, memberId) => `/lists/${listId}/members/${memberId}`,
            listBatchSubscribe: (listId) => `/lists/${listId}/members`,
            listInterestCategories: (listId) => `/lists/${listId}/interest-categories`,
            listInterests: (listId, categoryId) => `/lists/${listId}/interest-categories/${categoryId}/interests`,
            
            // Campaigns
            campaigns: '/campaigns',
            campaignById: (campaignId) => `/campaigns/${campaignId}`,
            campaignContent: (campaignId) => `/campaigns/${campaignId}/content`,
            campaignSend: (campaignId) => `/campaigns/${campaignId}/actions/send`,
            campaignSchedule: (campaignId) => `/campaigns/${campaignId}/actions/schedule`,
            campaignTest: (campaignId) => `/campaigns/${campaignId}/actions/test`,
            
            // Templates
            templates: '/templates',
            templateById: (templateId) => `/templates/${templateId}`,
            
            // Automations
            automations: '/automations',
            automationById: (automationId) => `/automations/${automationId}`,
            automationEmails: (automationId) => `/automations/${automationId}/emails`,
            automationEmailById: (automationId, emailId) => `/automations/${automationId}/emails/${emailId}`,
            
            // Reports
            reports: '/reports',
            reportById: (campaignId) => `/reports/${campaignId}`,
            reportEmailActivity: (campaignId) => `/reports/${campaignId}/email-activity`,
            
            // Audience
            audienceMembers: '/lists',
            
            // File Manager
            fileManager: '/file-manager/files',
            fileById: (fileId) => `/file-manager/files/${fileId}`,
            
            // Ping
            ping: '/ping',
        };

        this.authorizationUri = encodeURI(
            `https://login.mailchimp.com/oauth2/authorize?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}`
        );
        this.tokenUri = 'https://login.mailchimp.com/oauth2/token';

        this.access_token = get(params, 'access_token', null);
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    async getTokenFromCode(code) {
        const tokenData = await super.getTokenFromCode(code);
        
        // Extract server prefix from metadata
        if (tokenData.metadata && tokenData.metadata.dc) {
            this.server_prefix = tokenData.metadata.dc;
            this.baseUrl = `https://${this.server_prefix}.api.mailchimp.com/3.0`;
            tokenData.server_prefix = this.server_prefix;
        }
        
        return tokenData;
    }

    addJsonHeaders(options) {
        const jsonHeaders = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        };
    }

    async _post(options, stringify = true) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify = true) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _put(options, stringify = true) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // **************************   Account Methods   **********************************

    async getAccount() {
        if (!this.baseUrl) {
            throw new Error('Server prefix not set. Ensure authentication is complete.');
        }
        
        const options = {
            url: this.baseUrl + this.URLs.account,
        };
        return this._get(options);
    }

    async ping() {
        if (!this.baseUrl) {
            throw new Error('Server prefix not set. Ensure authentication is complete.');
        }
        
        const options = {
            url: this.baseUrl + this.URLs.ping,
        };
        return this._get(options);
    }

    // **************************   Lists Methods   **********************************

    async getLists(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.lists,
            query: params,
        };
        return this._get(options);
    }

    async getList(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
        };
        return this._get(options);
    }

    async createList(listData) {
        const options = {
            url: this.baseUrl + this.URLs.lists,
            body: listData,
        };
        return this._post(options);
    }

    async updateList(listId, listData) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
            body: listData,
        };
        return this._patch(options);
    }

    async deleteList(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
        };
        return this._delete(options);
    }

    // **************************   List Members Methods   **********************************

    async getListMembers(listId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.listMembers(listId),
            query: params,
        };
        return this._get(options);
    }

    async getListMember(listId, memberIdOrEmail) {
        const options = {
            url: this.baseUrl + this.URLs.listMemberById(listId, memberIdOrEmail),
        };
        return this._get(options);
    }

    async addListMember(listId, memberData) {
        const options = {
            url: this.baseUrl + this.URLs.listMembers(listId),
            body: memberData,
        };
        return this._post(options);
    }

    async updateListMember(listId, memberIdOrEmail, memberData) {
        const options = {
            url: this.baseUrl + this.URLs.listMemberById(listId, memberIdOrEmail),
            body: memberData,
        };
        return this._patch(options);
    }

    async addOrUpdateListMember(listId, memberIdOrEmail, memberData) {
        const options = {
            url: this.baseUrl + this.URLs.listMemberById(listId, memberIdOrEmail),
            body: memberData,
        };
        return this._put(options);
    }

    async deleteListMember(listId, memberIdOrEmail) {
        const options = {
            url: this.baseUrl + this.URLs.listMemberById(listId, memberIdOrEmail),
        };
        return this._delete(options);
    }

    async batchSubscribeMembers(listId, members, updateExisting = false) {
        const options = {
            url: this.baseUrl + this.URLs.listBatchSubscribe(listId),
            body: {
                members,
                update_existing: updateExisting,
            },
        };
        return this._post(options);
    }

    // **************************   Campaigns Methods   **********************************

    async getCampaigns(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.campaigns,
            query: params,
        };
        return this._get(options);
    }

    async getCampaign(campaignId) {
        const options = {
            url: this.baseUrl + this.URLs.campaignById(campaignId),
        };
        return this._get(options);
    }

    async createCampaign(campaignData) {
        const options = {
            url: this.baseUrl + this.URLs.campaigns,
            body: campaignData,
        };
        return this._post(options);
    }

    async updateCampaign(campaignId, campaignData) {
        const options = {
            url: this.baseUrl + this.URLs.campaignById(campaignId),
            body: campaignData,
        };
        return this._patch(options);
    }

    async deleteCampaign(campaignId) {
        const options = {
            url: this.baseUrl + this.URLs.campaignById(campaignId),
        };
        return this._delete(options);
    }

    async getCampaignContent(campaignId) {
        const options = {
            url: this.baseUrl + this.URLs.campaignContent(campaignId),
        };
        return this._get(options);
    }

    async setCampaignContent(campaignId, content) {
        const options = {
            url: this.baseUrl + this.URLs.campaignContent(campaignId),
            body: content,
        };
        return this._put(options);
    }

    async sendCampaign(campaignId) {
        const options = {
            url: this.baseUrl + this.URLs.campaignSend(campaignId),
        };
        return this._post(options);
    }

    async scheduleCampaign(campaignId, scheduleTime, timezoneOffset = 0) {
        const options = {
            url: this.baseUrl + this.URLs.campaignSchedule(campaignId),
            body: {
                schedule_time: scheduleTime,
                timezone_offset: timezoneOffset,
            },
        };
        return this._post(options);
    }

    async sendTestCampaign(campaignId, testEmails, sendType = 'html') {
        const options = {
            url: this.baseUrl + this.URLs.campaignTest(campaignId),
            body: {
                test_emails: testEmails,
                send_type: sendType,
            },
        };
        return this._post(options);
    }

    // **************************   Templates Methods   **********************************

    async getTemplates(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.templates,
            query: params,
        };
        return this._get(options);
    }

    async getTemplate(templateId) {
        const options = {
            url: this.baseUrl + this.URLs.templateById(templateId),
        };
        return this._get(options);
    }

    async createTemplate(templateData) {
        const options = {
            url: this.baseUrl + this.URLs.templates,
            body: templateData,
        };
        return this._post(options);
    }

    async updateTemplate(templateId, templateData) {
        const options = {
            url: this.baseUrl + this.URLs.templateById(templateId),
            body: templateData,
        };
        return this._patch(options);
    }

    async deleteTemplate(templateId) {
        const options = {
            url: this.baseUrl + this.URLs.templateById(templateId),
        };
        return this._delete(options);
    }

    // **************************   Automations Methods   **********************************

    async getAutomations(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.automations,
            query: params,
        };
        return this._get(options);
    }

    async getAutomation(automationId) {
        const options = {
            url: this.baseUrl + this.URLs.automationById(automationId),
        };
        return this._get(options);
    }

    async getAutomationEmails(automationId) {
        const options = {
            url: this.baseUrl + this.URLs.automationEmails(automationId),
        };
        return this._get(options);
    }

    async getAutomationEmail(automationId, emailId) {
        const options = {
            url: this.baseUrl + this.URLs.automationEmailById(automationId, emailId),
        };
        return this._get(options);
    }

    // **************************   Reports Methods   **********************************

    async getReports(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.reports,
            query: params,
        };
        return this._get(options);
    }

    async getCampaignReport(campaignId) {
        const options = {
            url: this.baseUrl + this.URLs.reportById(campaignId),
        };
        return this._get(options);
    }

    async getCampaignEmailActivity(campaignId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.reportEmailActivity(campaignId),
            query: params,
        };
        return this._get(options);
    }

    // **************************   Interest Categories Methods   **********************************

    async getListInterestCategories(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listInterestCategories(listId),
        };
        return this._get(options);
    }

    async getListInterests(listId, categoryId) {
        const options = {
            url: this.baseUrl + this.URLs.listInterests(listId, categoryId),
        };
        return this._get(options);
    }

    // **************************   File Manager Methods   **********************************

    async getFiles(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.fileManager,
            query: params,
        };
        return this._get(options);
    }

    async getFile(fileId) {
        const options = {
            url: this.baseUrl + this.URLs.fileById(fileId),
        };
        return this._get(options);
    }

    async uploadFile(fileData) {
        const options = {
            url: this.baseUrl + this.URLs.fileManager,
            body: fileData,
        };
        return this._post(options);
    }

    async deleteFile(fileId) {
        const options = {
            url: this.baseUrl + this.URLs.fileById(fileId),
        };
        return this._delete(options);
    }
}

module.exports = { Api };