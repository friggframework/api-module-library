const { ApiKeyRequester, get } = require('@friggframework/core');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        
        this.api_key = get(params, 'api_key', null);
        this.baseUrl = 'https://api.sendgrid.com/v3';
        
        this.URLs = {
            // Mail Send
            mail: '/mail/send',
            
            // User Profile
            user: '/user/profile',
            account: '/user/account',
            
            // Templates
            templates: '/templates',
            templateById: (templateId) => `/templates/${templateId}`,
            templateVersions: (templateId) => `/templates/${templateId}/versions`,
            templateVersionById: (templateId, versionId) => `/templates/${templateId}/versions/${versionId}`,
            
            // Sender Authentication
            senderIdentities: '/verified_senders',
            senderIdentityById: (senderId) => `/verified_senders/${senderId}`,
            
            // Lists
            lists: '/marketing/lists',
            listById: (listId) => `/marketing/lists/${listId}`,
            listContacts: (listId) => `/marketing/lists/${listId}/contacts`,
            
            // Contacts
            contacts: '/marketing/contacts',
            contactsSearch: '/marketing/contacts/search',
            contactById: (contactId) => `/marketing/contacts/${contactId}`,
            
            // Campaigns
            campaigns: '/marketing/campaigns',
            campaignById: (campaignId) => `/marketing/campaigns/${campaignId}`,
            campaignSchedule: (campaignId) => `/marketing/campaigns/${campaignId}/schedules`,
            
            // Suppressions
            suppressions: '/asm/suppressions',
            globalSuppressions: '/asm/suppressions/global',
            bounces: '/suppression/bounces',
            blocks: '/suppression/blocks',
            spam: '/suppression/spam_reports',
            invalid: '/suppression/invalid_emails',
            
            // Stats
            stats: '/stats',
            globalStats: '/stats/global',
            categoryStats: '/categories/stats',
            
            // Subusers
            subusers: '/subusers',
            subuserById: (username) => `/subusers/${username}`,
            
            // API Keys
            apiKeys: '/api_keys',
            apiKeyById: (keyId) => `/api_keys/${keyId}`,
            
            // Webhooks
            webhookStats: '/user/webhooks/event/settings',
            webhookParse: '/user/webhooks/parse/settings',
        };
    }

    addAuthHeaders(headers = {}) {
        if (this.api_key) {
            headers.Authorization = `Bearer ${this.api_key}`;
        }
        return headers;
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

    // **************************   Mail Send Methods   **********************************

    async sendMail(mailData) {
        const options = {
            url: this.baseUrl + this.URLs.mail,
            body: mailData,
        };
        return this._post(options);
    }

    async sendSimpleEmail(to, from, subject, content, contentType = 'text/plain') {
        const mailData = {
            personalizations: [
                {
                    to: [{ email: to }],
                    subject: subject
                }
            ],
            from: { email: from },
            content: [
                {
                    type: contentType,
                    value: content
                }
            ]
        };

        return this.sendMail(mailData);
    }

    async sendEmailWithTemplate(to, from, templateId, dynamicTemplateData = {}) {
        const mailData = {
            personalizations: [
                {
                    to: [{ email: to }],
                    dynamic_template_data: dynamicTemplateData
                }
            ],
            from: { email: from },
            template_id: templateId
        };

        return this.sendMail(mailData);
    }

    // **************************   User Profile Methods   **********************************

    async getCurrentUser() {
        const options = {
            url: this.baseUrl + this.URLs.user,
        };
        return this._get(options);
    }

    async updateUserProfile(profileData) {
        const options = {
            url: this.baseUrl + this.URLs.user,
            body: profileData,
        };
        return this._patch(options);
    }

    async getUserAccount() {
        const options = {
            url: this.baseUrl + this.URLs.account,
        };
        return this._get(options);
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

    async getTemplateVersions(templateId) {
        const options = {
            url: this.baseUrl + this.URLs.templateVersions(templateId),
        };
        return this._get(options);
    }

    async createTemplateVersion(templateId, versionData) {
        const options = {
            url: this.baseUrl + this.URLs.templateVersions(templateId),
            body: versionData,
        };
        return this._post(options);
    }

    // **************************   Contacts Methods   **********************************

    async getContacts(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.contacts,
            query: params,
        };
        return this._get(options);
    }

    async addContacts(contacts) {
        const options = {
            url: this.baseUrl + this.URLs.contacts,
            body: { contacts },
        };
        return this._put(options);
    }

    async searchContacts(query) {
        const options = {
            url: this.baseUrl + this.URLs.contactsSearch,
            body: { query },
        };
        return this._post(options);
    }

    async getContactById(contactId) {
        const options = {
            url: this.baseUrl + this.URLs.contactById(contactId),
        };
        return this._get(options);
    }

    async deleteContacts(contactIds) {
        const options = {
            url: this.baseUrl + this.URLs.contacts,
            query: { ids: contactIds.join(',') },
        };
        return this._delete(options);
    }

    // **************************   Lists Methods   **********************************

    async getLists() {
        const options = {
            url: this.baseUrl + this.URLs.lists,
        };
        return this._get(options);
    }

    async createList(name, contactCount = 0) {
        const options = {
            url: this.baseUrl + this.URLs.lists,
            body: {
                name,
                contact_count: contactCount
            },
        };
        return this._post(options);
    }

    async getList(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
        };
        return this._get(options);
    }

    async updateList(listId, name) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
            body: { name },
        };
        return this._patch(options);
    }

    async deleteList(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
            query: { delete_contacts: false },
        };
        return this._delete(options);
    }

    async addContactsToList(listId, contactIds) {
        const options = {
            url: this.baseUrl + this.URLs.listContacts(listId),
            body: { contact_ids: contactIds },
        };
        return this._post(options);
    }

    async removeContactsFromList(listId, contactIds) {
        const options = {
            url: this.baseUrl + this.URLs.listContacts(listId),
            query: { contact_ids: contactIds.join(',') },
        };
        return this._delete(options);
    }

    // **************************   Campaigns Methods   **********************************

    async getCampaigns(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.campaigns,
            query: params,
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

    async getCampaign(campaignId) {
        const options = {
            url: this.baseUrl + this.URLs.campaignById(campaignId),
        };
        return this._get(options);
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

    async scheduleCampaign(campaignId, sendAt) {
        const options = {
            url: this.baseUrl + this.URLs.campaignSchedule(campaignId),
            body: { send_at: sendAt },
        };
        return this._post(options);
    }

    // **************************   Suppressions Methods   **********************************

    async getGlobalSuppressions() {
        const options = {
            url: this.baseUrl + this.URLs.globalSuppressions,
        };
        return this._get(options);
    }

    async addGlobalSuppression(email) {
        const options = {
            url: this.baseUrl + this.URLs.globalSuppressions,
            body: { recipient_emails: [email] },
        };
        return this._post(options);
    }

    async removeGlobalSuppression(email) {
        const options = {
            url: this.baseUrl + this.URLs.globalSuppressions + `/${email}`,
        };
        return this._delete(options);
    }

    async getBounces(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.bounces,
            query: params,
        };
        return this._get(options);
    }

    async deleteBounces(emails) {
        const options = {
            url: this.baseUrl + this.URLs.bounces,
            body: { emails },
        };
        return this._delete(options);
    }

    // **************************   Stats Methods   **********************************

    async getGlobalStats(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.globalStats,
            query: params,
        };
        return this._get(options);
    }

    async getCategoryStats(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.categoryStats,
            query: params,
        };
        return this._get(options);
    }

    // **************************   Sender Identity Methods   **********************************

    async getSenderIdentities() {
        const options = {
            url: this.baseUrl + this.URLs.senderIdentities,
        };
        return this._get(options);
    }

    async createSenderIdentity(senderData) {
        const options = {
            url: this.baseUrl + this.URLs.senderIdentities,
            body: senderData,
        };
        return this._post(options);
    }

    async getSenderIdentity(senderId) {
        const options = {
            url: this.baseUrl + this.URLs.senderIdentityById(senderId),
        };
        return this._get(options);
    }

    async updateSenderIdentity(senderId, senderData) {
        const options = {
            url: this.baseUrl + this.URLs.senderIdentityById(senderId),
            body: senderData,
        };
        return this._patch(options);
    }

    async deleteSenderIdentity(senderId) {
        const options = {
            url: this.baseUrl + this.URLs.senderIdentityById(senderId),
        };
        return this._delete(options);
    }
}

module.exports = { Api };