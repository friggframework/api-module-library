const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.cc.email/v3';
        
        this.URLs = {
            // Account Info
            accountInfo: '/account/summary',
            
            // Contact Lists
            contactLists: '/contact_lists',
            contactListById: (listId) => `/contact_lists/${listId}`,
            
            // Contacts
            contacts: '/contacts',
            contactById: (contactId) => `/contacts/${contactId}`,
            contactCustomFields: '/contact_custom_fields',
            
            // Email Campaigns
            emailCampaigns: '/emails',
            emailCampaignById: (campaignId) => `/emails/${campaignId}`,
            emailCampaignActivities: (campaignId) => `/emails/${campaignId}/activities`,
            
            // Activities
            activities: '/activities',
            activityById: (activityId) => `/activities/${activityId}`,
            
            // Bulk Activities
            bulkImportContacts: '/activities/contacts_file_import',
            bulkDeleteContacts: '/activities/remove_contacts',
            
            // Reporting
            emailReports: '/reports/email_reports',
            contactReports: '/reports/contact_reports',
            
            // Landing Pages
            landingPages: '/landing_pages',
            landingPageById: (pageId) => `/landing_pages/${pageId}`,
            
            // Webhooks
            webhooks: '/webhooks',
            webhookById: (webhookId) => `/webhooks/${webhookId}`,
            
            // Segments
            segments: '/segments',
            segmentById: (segmentId) => `/segments/${segmentId}`,
            
            // Tags
            tags: '/contact_tags',
            tagById: (tagId) => `/contact_tags/${tagId}`
        };
        
        this.authorizationUri = encodeURI(
            `https://authz.constantcontact.com/oauth2/default/v1/authorize?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}&scope=${this.scope}`
        );
        this.tokenUri = 'https://authz.constantcontact.com/oauth2/default/v1/token';
        
        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }
    
    async getUserDetails() {
        const options = {
            url: this.baseUrl + this.URLs.accountInfo,
        };
        return this._get(options);
    }
    
    // **************************   Contact Lists   **********************************
    
    async createContactList(listData) {
        const options = {
            url: this.baseUrl + this.URLs.contactLists,
            body: listData,
        };
        return this._post(options);
    }
    
    async listContactLists(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.contactLists,
            query: params
        };
        return this._get(options);
    }
    
    async getContactListById(listId) {
        const options = {
            url: this.baseUrl + this.URLs.contactListById(listId),
        };
        return this._get(options);
    }
    
    async updateContactList(listId, listData) {
        const options = {
            url: this.baseUrl + this.URLs.contactListById(listId),
            body: listData,
        };
        return this._put(options);
    }
    
    async deleteContactList(listId) {
        const options = {
            url: this.baseUrl + this.URLs.contactListById(listId),
        };
        return this._delete(options);
    }
    
    // **************************   Contacts   **********************************
    
    async createContact(contactData) {
        const options = {
            url: this.baseUrl + this.URLs.contacts,
            body: contactData,
        };
        return this._post(options);
    }
    
    async listContacts(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.contacts,
            query: params
        };
        return this._get(options);
    }
    
    async getContactById(contactId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.contactById(contactId),
            query: params
        };
        return this._get(options);
    }
    
    async updateContact(contactId, contactData) {
        const options = {
            url: this.baseUrl + this.URLs.contactById(contactId),
            body: contactData,
        };
        return this._put(options);
    }
    
    async deleteContact(contactId) {
        const options = {
            url: this.baseUrl + this.URLs.contactById(contactId),
        };
        return this._delete(options);
    }
    
    // **************************   Email Campaigns   **********************************
    
    async createEmailCampaign(campaignData) {
        const options = {
            url: this.baseUrl + this.URLs.emailCampaigns,
            body: campaignData,
        };
        return this._post(options);
    }
    
    async listEmailCampaigns(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.emailCampaigns,
            query: params
        };
        return this._get(options);
    }
    
    async getEmailCampaignById(campaignId) {
        const options = {
            url: this.baseUrl + this.URLs.emailCampaignById(campaignId),
        };
        return this._get(options);
    }
    
    async updateEmailCampaign(campaignId, campaignData) {
        const options = {
            url: this.baseUrl + this.URLs.emailCampaignById(campaignId),
            body: campaignData,
        };
        return this._put(options);
    }
    
    async deleteEmailCampaign(campaignId) {
        const options = {
            url: this.baseUrl + this.URLs.emailCampaignById(campaignId),
        };
        return this._delete(options);
    }
    
    async sendEmailCampaign(campaignId) {
        const options = {
            url: this.baseUrl + this.URLs.emailCampaignById(campaignId) + '/schedules',
            body: { scheduled_date: new Date().toISOString() },
        };
        return this._post(options);
    }
    
    async getEmailCampaignActivities(campaignId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.emailCampaignActivities(campaignId),
            query: params
        };
        return this._get(options);
    }
    
    // **************************   Activities   **********************************
    
    async listActivities(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.activities,
            query: params
        };
        return this._get(options);
    }
    
    async getActivityById(activityId) {
        const options = {
            url: this.baseUrl + this.URLs.activityById(activityId),
        };
        return this._get(options);
    }
    
    // **************************   Bulk Operations   **********************************
    
    async bulkImportContacts(importData) {
        const options = {
            url: this.baseUrl + this.URLs.bulkImportContacts,
            body: importData,
        };
        return this._post(options);
    }
    
    async bulkDeleteContacts(deleteData) {
        const options = {
            url: this.baseUrl + this.URLs.bulkDeleteContacts,
            body: deleteData,
        };
        return this._post(options);
    }
    
    // **************************   Reporting   **********************************
    
    async getEmailReports(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.emailReports,
            query: params
        };
        return this._get(options);
    }
    
    async getContactReports(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.contactReports,
            query: params
        };
        return this._get(options);
    }
    
    // **************************   Landing Pages   **********************************
    
    async createLandingPage(pageData) {
        const options = {
            url: this.baseUrl + this.URLs.landingPages,
            body: pageData,
        };
        return this._post(options);
    }
    
    async listLandingPages(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.landingPages,
            query: params
        };
        return this._get(options);
    }
    
    async getLandingPageById(pageId) {
        const options = {
            url: this.baseUrl + this.URLs.landingPageById(pageId),
        };
        return this._get(options);
    }
    
    async updateLandingPage(pageId, pageData) {
        const options = {
            url: this.baseUrl + this.URLs.landingPageById(pageId),
            body: pageData,
        };
        return this._put(options);
    }
    
    async deleteLandingPage(pageId) {
        const options = {
            url: this.baseUrl + this.URLs.landingPageById(pageId),
        };
        return this._delete(options);
    }
    
    // **************************   Webhooks   **********************************
    
    async createWebhook(webhookData) {
        const options = {
            url: this.baseUrl + this.URLs.webhooks,
            body: webhookData,
        };
        return this._post(options);
    }
    
    async listWebhooks() {
        const options = {
            url: this.baseUrl + this.URLs.webhooks,
        };
        return this._get(options);
    }
    
    async getWebhookById(webhookId) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        };
        return this._get(options);
    }
    
    async updateWebhook(webhookId, webhookData) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(webhookId),
            body: webhookData,
        };
        return this._put(options);
    }
    
    async deleteWebhook(webhookId) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        };
        return this._delete(options);
    }
}

module.exports = { Api };
