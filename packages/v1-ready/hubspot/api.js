const {OAuth2Requester, get} = require('@friggframework/core');

class Api extends OAuth2Requester {
    /** @type {string} Pinned HubSpot date-based API version (YYYY-MM). */
    static API_VERSION = '2026-09';

    constructor(params) {
        super(params);
        // The majority of the properties for OAuth are default loaded by OAuth2Requester.
        // This includes the `client_id`, `client_secret`, `scopes`, and `redirect_uri`.
        this.baseUrl = 'https://api.hubapi.com';
        // Pin HubSpot's current date-based API version (DBV). Do not use
        // unpinned/latest path aliases — migrate consciously when a new
        // YYYY-MM version is released. Docs:
        // https://developers.hubspot.com/docs/api-reference/latest/overview
        // https://developers.hubspot.com/docs/api-reference/legacy/migration-guide
        this.apiVersion = Api.API_VERSION;

        const v = this.apiVersion;
        this.URLs = {
            authorization: '/oauth/authorize',
            access_token: `/oauth/${v}/token`,
            tokenIntrospect: `/oauth/${v}/token/introspect`,
            accountDetails: `/account-info/${v}/details`,
            contacts: `/crm/objects/${v}/contacts`,
            contactById: (contactId) => `/crm/objects/${v}/contacts/${contactId}`,
            getBatchContactsById: `/crm/objects/${v}/contacts/batch/read`,
            contactSearch: `/crm/objects/${v}/contacts/search`,
            companies: `/crm/objects/${v}/companies`,
            companyById: (compId) => `/crm/objects/${v}/companies/${compId}`,
            companySearch: `/crm/objects/${v}/companies/search`,
            getBatchCompaniesById: `/crm/objects/${v}/companies/batch/read`,
            // App events (replacement for legacy crm/v3/timeline/events):
            // https://developers.hubspot.com/docs/apps/developer-platform/add-features/app-events/send-event-occurrences
            createTimelineEvent: `/integrators/timeline/${v}/events`,
            properties: (objType) => `/crm/properties/${v}/${objType}`,
            propertiesByName: (objType, propName) =>
                `/crm/properties/${v}/${objType}/${propName}`,
            deals: `/crm/objects/${v}/deals`,
            dealById: (dealId) => `/crm/objects/${v}/deals/${dealId}`,
            searchDeals: `/crm/objects/${v}/deals/search`,
            readBatchAssociations: (fromObjectType, toObjectType) =>
                `/crm/associations/${v}/${fromObjectType}/${toObjectType}/batch/read`,
            createBatchAssociations: (fromObjectType, toObjectType) =>
                `/crm/associations/${v}/${fromObjectType}/${toObjectType}/batch/create`,
            createBatchAssociationsDefault: (fromObjectType, toObjectType) =>
                `/crm/associations/${v}/${fromObjectType}/${toObjectType}/batch/associate/default`,
            deleteBatchAssociations: (fromObjectType, toObjectType) =>
                `/crm/associations/${v}/${fromObjectType}/${toObjectType}/batch/archive`,
            deleteBatchAssociationLabels: (fromObjectType, toObjectType) =>
                `/crm/associations/${v}/${fromObjectType}/${toObjectType}/batch/labels/archive`,
            getPipelineDetails: (objType) => `/crm/pipelines/${v}/${objType}`,
            getOwnerById: (ownerId) => `/crm/owners/${v}/${ownerId}`,
            // Legacy Contacts Lists API (/contacts/v1/lists) → CRM Lists
            contactList: `/crm/lists/${v}`,
            contactListById: (listId) => `/crm/lists/${v}/${listId}`,
            // https://developers.hubspot.com/docs/api-reference/latest/crm/objects/schemas/guide
            customObjectSchemas: `/crm-object-schemas/${v}/schemas`,
            customObjectSchemaByObjectType: (objectType) =>
                `/crm-object-schemas/${v}/schemas/${objectType}`,
            customObjects: (objectType) => `/crm/objects/${v}/${objectType}`,
            customObjectsSearch: (objectType) => `/crm/objects/${v}/${objectType}/search`,
            customObjectById: (objectType, objId) =>
                `/crm/objects/${v}/${objectType}/${objId}`,
            bulkCreateCustomObjects: (objectType) =>
                `/crm/objects/${v}/${objectType}/batch/create`,
            bulkReadCustomObjects: (objectType) =>
                `/crm/objects/${v}/${objectType}/batch/read`,
            bulkUpdateCustomObjects: (objectType) =>
                `/crm/objects/${v}/${objectType}/batch/update`,
            bulkArchiveCustomObjects: (objectType) =>
                `/crm/objects/${v}/${objectType}/batch/archive`,
            landingPages: `/cms/pages/${v}/landing-pages`,
            sitePages: `/cms/pages/${v}/site-pages`,
            blogPosts: `/cms/blogs/${v}/posts`,
            landingPageById: (landingPageId) => `/cms/pages/${v}/landing-pages/${landingPageId}`,
            sitePageById: (sitePageId) => `/cms/pages/${v}/site-pages/${sitePageId}`,
            blogPostById: (blogPostId) => `/cms/blogs/${v}/posts/${blogPostId}`,
            emailTemplates: `/automation/email-templates/${v}`,
            emailTemplateById: (templateId) => `/automation/email-templates/${v}/${templateId}`,
            lists: `/crm/lists/${v}`,
            listById: (listId) => `/crm/lists/${v}/${listId}`,
            listSearch: `/crm/lists/${v}/search`,
            listMemberships: (listId) => `/crm/lists/${v}/${listId}/memberships`,
            listMembershipsAddRemove: (listId) => `/crm/lists/${v}/${listId}/memberships/add-and-remove`,
            associations: (fromObject, toObject) => `/crm/associations/${v}/${fromObject}/${toObject}`,
            associationLabels: (fromObject, toObject) => `/crm/associations/${v}/${fromObject}/${toObject}/labels`,
            // Webhook subscription management (app-level; not used by the receiver extension)
            webhookSettings: (appId) => `/app-webhooks/${v}/${appId}/settings`,
            webhookSubscriptions: (appId) => `/app-webhooks/${v}/${appId}/subscriptions`,
            webhookSubscriptionById: (appId, subscriptionId) =>
                `/app-webhooks/${v}/${appId}/subscriptions/${subscriptionId}`,
        };

        this.authorizationUri = encodeURI(
            `https://app.hubspot.com/oauth/authorize?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&scope=${this.scope}&state=${this.state}`
        );
        this.tokenUri = `https://api.hubapi.com/oauth/${v}/token`;

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    addJsonHeaders(options) {
        const jsonHeaders = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        }
    }
    async _post(options, stringify) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // **************************   Companies   **********************************

    async createCompany(body) {
        const options = {
            url: this.baseUrl + this.URLs.companies,
            body: {
                properties: body,
            },
        };

        return this._post(options);
    }

    async listCompanies() {
        const options = {
            url: this.baseUrl + this.URLs.companies,
        };

        return this._get(options);
    }

    async updateCompany(id, body) {
        const options = {
            url: this.baseUrl + this.URLs.companyById(id),
            body,
        };
        return this._patch(options);
    }

    async searchCompanies(body) {
        const options = {
            url: this.baseUrl + this.URLs.companySearch,
            body,
        };
        return this._post(options);
    }

    // Docs described endpoint as archive company instead of delete. Will have to make due.
    async archiveCompany(compId) {
        const options = {
            url: this.baseUrl + this.URLs.companyById(compId),
        };

        return this._delete(options);
    }

    async getCompanyById(compId) {
        const propsString = await this._propertiesList('company');

        const options = {
            url: this.baseUrl + this.URLs.companyById(compId),
            query: {
                properties: propsString,
                associations: 'contacts',
            },
        };

        return this._get(options);
    }

    async batchGetCompaniesById(params) {
        // inputs.length should be < 100
        const inputs = get(params, 'inputs');
        const properties = get(params, 'properties', []);

        const body = {
            inputs,
            properties,
        };
        const options = {
            url: this.baseUrl + this.URLs.getBatchCompaniesById,
            body,
            query: {
                archived: 'false',
            },
        };
        return this._post(options);
    }

    // **************************   Contacts   **********************************

    async createContact(body) {
        const options = {
            url: this.baseUrl + this.URLs.contacts,
            body: {
                properties: body,
            },
        };

        return this._post(options);
    }

    async listContacts(params) {
        const limit = get(params, 'limit', 100);
        const after = get(params, 'after', null);

        let properties = get(params, 'properties', null);
        if (!properties) {
            properties = await this._propertiesList('contact');
        }

        const query = { limit, properties };
        // HubSpot rejects `after=null`/`after=` with a 400, so only send the
        // paging cursor once we actually have one (i.e. from the second page
        // onward). Without this guard, paging past the first page is impossible
        // and callers are forced onto the search endpoint, which is hard-capped
        // at 10,000 results.
        if (after !== null && after !== undefined && after !== '') {
            query.after = after;
        }

        const options = {
            url: this.baseUrl + this.URLs.contacts,
            query,
        };

        return this._get(options);
    }

    async archiveContact(id) {
        const options = {
            url: this.baseUrl + this.URLs.contactById(id),
        };

        return this._delete(options);
    }

    async getContactById(contactId) {
        const propsString = await this._propertiesList('contact');

        const options = {
            url: this.baseUrl + this.URLs.contactById(contactId),
            query: {
                properties: propsString,
            },
        };

        return this._get(options);
    }

    async updateContact(contactId, properties) {
        const options = {
            url: this.baseUrl + this.URLs.contactById(contactId),
            body: {
                properties,
            },
        }
        return this._patch(options);
    }

    async batchGetContactsById(body) {
        // const props = await this.listProperties('contact');
        // const properties = props.results.map((prop) => prop.name);
        /* Example Contacts:
        [{id: 1}] */
        /* Example properties:
        [''] */

        const options = {
            url: this.baseUrl + this.URLs.getBatchContactsById,
            body,
            query: {
                archived: 'false',
            },
        };
        return this._post(options);
    }

    // **************************   Deals   **********************************

    async createDeal(body) {
        const options = {
            url: this.baseUrl + this.URLs.deals,
            body: {
                properties: body,
            },
        };

        return this._post(options);
    }

    async archiveDeal(dealId) {
        const options = {
            url: this.baseUrl + this.URLs.dealById(dealId),
        };

        return this._delete(options);
    }

    async getDealById(dealId) {
        const propsString = await this._propertiesList('deal');

        const options = {
            url: this.baseUrl + this.URLs.dealById(dealId),
            query: {
                properties: propsString,
                associations: 'contacts,company',
            },
        };
        return this._get(options);
    }

    async getDealStageHistory(dealId) {
        // Replaces legacy GET /deals/v1/deal/{id}?includePropertyVersions=true.
        // Dated objects API: propertiesWithHistory=dealstage.
        // https://developers.hubspot.com/docs/api-reference/latest/crm/using-object-apis
        const options = {
            url: this.baseUrl + this.URLs.dealById(dealId),
            query: {propertiesWithHistory: 'dealstage'},
        };
        const res = await this._get(options);
        const history =
            (res.propertiesWithHistory && res.propertiesWithHistory.dealstage) ||
            [];
        return history;
    }

    // pageObj can look something like this:
    // { limit: 10, after: 10 }
    async listDeals(pageObj) {
        const propsString = await this._propertiesList('deal');

        const options = {
            url: this.baseUrl + this.URLs.deals,
            query: {
                properties: propsString,
                associations: 'contacts,companies',
            },
        };
        if (pageObj) {
            Object.assign(options.query, pageObj);
        }
        return this._get(options);
    }

    async searchDeals(params) {
        const allProps = get(params, 'allProps', true);
        const propsArray = get(params, 'props', []);
        const limit = get(params, 'limit', 10);
        const after = get(params, 'after', 0);
        const filterGroups = get(params, 'filterGroups', []);
        const sorts = get(params, 'sorts', []);

        if (allProps && propsArray.length === 0) {
            const dealProps = await this.listProperties('deal');
            for (const prop of dealProps.results) {
                propsArray.push(prop.name);
            }
        }

        const searchBody = {
            filterGroups,
            sorts,
            after,
            properties: propsArray,
            limit,
        };

        const options = {
            url: this.baseUrl + this.URLs.searchDeals,
            body: searchBody,
        };
        return this._post(options);
    }

    async updateDeal(params) {
        const dealId = get(params, 'dealId');
        const properties = get(params, 'properties');
        const body = {properties};
        const options = {
            url: this.baseUrl + this.URLs.dealById(dealId),
            body,
        };
        return this._patch(options);
    }

    // **************************   Contact Lists *****************************

    async createContactList(body) {
        const options = {
            url: this.baseUrl + this.URLs.contactList,
            body,
        };

        return this._post(options);
    }

    async deleteContactList(listId) {
        const options = {
            url: this.baseUrl + this.URLs.contactListById(listId),
        };

        return this._delete(options);
    }

    async getContactListById(listId) {
        const options = {
            url: this.baseUrl + this.URLs.contactListById(listId),
        };

        return this._get(options);
    }

    async listContactLists() {
        // Legacy GET /contacts/v1/lists → CRM Lists search.
        // https://developers.hubspot.com/docs/api-reference/latest/crm/lists/search/search-lists
        return this.searchLists('', 0, 500, []);
    }

    async updateContactList(listId, body) {
        // CRM Lists update is PATCH (was POST on contacts/v1).
        const options = {
            url: this.baseUrl + this.URLs.contactListById(listId),
            body,
        };
        return this._patch(options);
    }

    //* **************************   Custom Object Schemas   ******************* */

    async createCustomObjectSchema(body) {
        const options = {
            url: this.baseUrl + this.URLs.customObjectSchemas,
            body,
        };


        return this._post(options);
    }

    async deleteCustomObjectSchema(objectType, hardDelete) {
        // This is a hard delete. Softer would be without query
        // Either way, this can only be done after all records of the objectType are deleted.
        const options = {
            url:
                this.baseUrl +
                this.URLs.customObjectSchemaByObjectType(objectType),
            query: {},
        };

        if (this.api_key) {
            options.query.hapikey = this.api_key;
        }
        if (hardDelete) {
            options.query.archived = true;
        }

        return this._delete(options);
    }

    async getCustomObjectSchema(objectType, query) {
        const options = {
            url:
                this.baseUrl +
                this.URLs.customObjectSchemaByObjectType(objectType),
        };
        return this._get(options);
    }

    async listCustomObjectSchemas() {
        const options = {
            url: this.baseUrl + this.URLs.customObjectSchemas,
        };
        return this._get(options);
    }

    async updateCustomObjectSchema(objectType, body) {
        const options = {
            url:
                this.baseUrl +
                this.URLs.customObjectSchemaByObjectType(objectType),
            body,
        };
        return this._patch(options);
    }

    //* **************************   Custom Object   *************************** */

    async createCustomObject(objectType, body) {
        const options = {
            url: this.baseUrl + this.URLs.customObjects(objectType),
            body,
        };
        return this._post(options);
    }

    async bulkCreateCustomObjects(objectType, body) {
        const options = {
            url: this.baseUrl + this.URLs.bulkCreateCustomObjects(objectType),
            body,
        };
        return this._post(options);
    }

    async deleteCustomObject(objectType, objId) {
        const options = {
            url: this.baseUrl + this.URLs.customObjectById(objectType, objId),
            query: {},
        };
        return this._delete(options);
    }

    async bulkArchiveCustomObjects(objectType, body) {
        const url =
            this.baseUrl + this.URLs.bulkArchiveCustomObjects(objectType);
        const options = {
            method: 'POST',
            body: JSON.stringify(body),
            query: {},
        };
        this.addJsonHeaders(options);
        if (this.api_key) {
            options.query.hapikey = this.api_key;
        }

        // Using _request because it's a post request that returns an empty body
        return this._request(url, options);
    }

    async getCustomObject(objectType, objId) {
        const options = {
            url: this.baseUrl + this.URLs.customObjectById(objectType, objId),
        };
        return this._get(options);
    }

    async bulkReadCustomObjects(objectType, body) {
        const options = {
            url: this.baseUrl + this.URLs.bulkReadCustomObjects(objectType),
            body,
        };
        return this._post(options);
    }

    async listCustomObjects(objectType, query = {}) {
        const options = {
            url: this.baseUrl + this.URLs.customObjects(objectType),
            query,
        };
        return this._get(options);
    }

    async searchCustomObjects(objectType, body) {
        const options = {
            url: this.baseUrl + this.URLs.customObjectsSearch(objectType),
            body,
        };
        return this._post(options);
    }

    async updateCustomObject(objectType, objId, body) {
        const options = {
            url: this.baseUrl + this.URLs.customObjectById(objectType, objId),
            body,
        };
        return this._patch(options);
    }

    async bulkUpdateCustomObjects(objectType, body) {
        const options = {
            url: this.baseUrl + this.URLs.bulkUpdateCustomObjects(objectType),
            body,
        };
        return this._post(options);
    }

    // **************************   Properties / Custom Fields   **********************************

    // Same as below, but kept for legacy purposes. IE, don't break anything if we update module in projects
    async getProperties(objType) {
        return this.listProperties(objType);
    }

    // This better fits naming conventions
    async listProperties(objType) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.properties(objType)}`,
        });
    }

    async createProperty(objType, body) {
        const options = {
            url: this.baseUrl + this.URLs.properties(objType),
            body,
        };

        return this._post(options);
    }

    async deleteProperty(objType, propName) {
        const options = {
            url: this.baseUrl + this.URLs.propertiesByName(objType, propName),
        };

        return this._delete(options);
    }

    async getPropertyByName(objType, propName) {
        const options = {
            url: this.baseUrl + this.URLs.propertiesByName(objType, propName),
        };

        return this._get(options);
    }

    async updateProperty(objType, propName, body) {
        const options = {
            url: this.baseUrl + this.URLs.propertiesByName(objType, propName),
            body,
        };
        return this._patch(options);
    }

    // **************************   Owners   **********************************

    async getOwnerById(ownerId) {
        const options = {
            url: this.baseUrl + this.URLs.getOwnerById(ownerId),
        };
        return this._get(options);
    }

    // **************************   Timeline Events   **********************************

    async createTimelineEvent(
        objId,
        data = {},
        eventTemplateId = process.env.HUBSPOT_TIMELINE_EVENT_TEMPLATE_ID
    ) {
        // App events (DBV) replace legacy POST /crm/v3/timeline/events.
        // https://developers.hubspot.com/docs/apps/developer-platform/add-features/app-events/send-event-occurrences
        // Method args kept for callers; body maps to the dated contract:
        // eventTemplateId → eventTypeName, data.tokens → properties.
        const eventTypeName =
            get(data, 'eventTypeName', null) || eventTemplateId;
        const body = {
            eventTypeName,
            objectId: String(objId),
            id:
                get(data, 'id', null) ||
                `${eventTypeName}-${objId}-${Date.now()}`,
            properties: get(data, 'properties', null) || get(data, 'tokens', {}),
        };
        if (data && data.extraData !== undefined) {
            body.extraData = data.extraData;
        }
        return this._post({
            url: this.baseUrl + this.URLs.createTimelineEvent,
            body,
        });
    }

    // **************************   Pages   *****************************

    async getLandingPages(query = '') {
        const options = {
            url: `${this.baseUrl}${this.URLs.landingPages}`,
        };
        if (query !== '') {
            options.url = `${options.url}?${query}`
        }
        return this._get(options);
    }

    async getLandingPage(id) {
        const options = {
            url: `${this.baseUrl}${this.URLs.landingPageById(id)}`,
        };
        return this._get(options);
    }

    async updateLandingPage(objId, body, isDraft = false) {
        const draft = isDraft ? '/draft' : ''
        const options = {
            url: `${this.baseUrl}${this.URLs.landingPageById(objId)}${draft}`,
            body,
        };
        return this._patch(options);
    }

    async pushLandingPageDraftToLive(objId) {
        const options = {
            url: `${this.baseUrl}${this.URLs.landingPageById(objId)}/draft/push-live`,
        };
        return this._post(options);
    }

    async publishLandingPage(objId, publishDate) {
        const options = {
            url: `${this.baseUrl}${this.URLs.landingPages}/schedule`,
            body: {
                id: objId,
                publishDate
            },
        };
        return this._post(options);
    }

    async getSitePages(query = '') {
        const options = {
            url: `${this.baseUrl}${this.URLs.sitePages}`,
        };
        if (query !== '') {
            options.url = `${options.url}?${query}`
        }
        return this._get(options);
    }

    async getSitePage(id) {
        const options = {
            url: `${this.baseUrl}${this.URLs.sitePageById(id)}`,
        };
        return this._get(options);
    }


    async updateSitePage(objId, body, isDraft = false) {
        const draft = isDraft ? '/draft' : ''
        const options = {
            url: `${this.baseUrl}${this.URLs.sitePageById(objId)}${draft}`,
            body: body,
        };
        return this._patch(options);
    }

    async pushSitePageDraftToLive(objId) {
        const options = {
            url: `${this.baseUrl}${this.URLs.sitePageById(objId)}/draft/push-live`,
        };
        return this._post(options);
    }

    async publishSitePage(objId, publishDate) {
        const options = {
            url: `${this.baseUrl}${this.URLs.sitePages}/schedule`,
            body: {
                id: objId,
                publishDate
            },
        };
        return this._post(options);
    }

    // **************************   Blogs   *****************************

    async getBlogPosts(query = '') {
        const options = {
            url: `${this.baseUrl}${this.URLs.blogPosts}`,
        };
        if (query !== '') {
            options.url = `${options.url}?${query}`
        }
        return this._get(options);
    }

    async getBlogPost(id) {
        const options = {
            url: `${this.baseUrl}${this.URLs.blogPostById(id)}`,
        };
        return this._get(options);
    }

    async updateBlogPost(objId, body, isDraft = false) {
        const draft = isDraft ? '/draft' : ''
        const options = {
            url: `${this.baseUrl}${this.URLs.blogPostById(objId)}${draft}`,
            body: body,
        };
        return this._patch(options);
    }

    async pushBlogPostDraftToLive(objId) {
        const options = {
            url: `${this.baseUrl}${this.URLs.blogPostById(objId)}/draft/push-live`,
        };
        return this._post(options);
    }

    async publishBlogPost(objId, publishDate) {
        const options = {
            url: `${this.baseUrl}${this.URLs.blogPosts}/schedule`,
            body: {
                id: objId,
                publishDate
            },
        };
        return this._post(options);
    }

    // ***********************   Email Templates   **************************

    async getEmailTemplates(query = '') {
        const options = {
            url: `${this.baseUrl}${this.URLs.emailTemplates}`,
        };
        if (query !== '') {
            options.url = `${options.url}?${query}`
        }
        return this._get(options);
    }

    async getEmailTemplate(id) {
        const options = {
            url: `${this.baseUrl}${this.URLs.emailTemplateById(id)}`,
        };
        return this._get(options);
    }

    async updateEmailTemplate(objId, body) {
        // Automation email-templates 2026-09 uses PATCH (legacy content/v2 used PUT).
        // https://developers.hubspot.com/docs/api-reference/latest/automation/email-templates/update-email-template
        const options = {
            url: `${this.baseUrl}${this.URLs.emailTemplateById(objId)}`,
            body: body,
        };
        return this._patch(options);
    }

    async createEmailTemplate(body) {
        const options = {
            url: `${this.baseUrl}${this.URLs.emailTemplates}`,
            body: body,
        };
        return this._post(options);
    }

    async deleteEmailTemplate(id) {
        const options = {
            url: `${this.baseUrl}${this.URLs.emailTemplateById(id)}`,
        };
        return this._delete(options);
    }

    // **************************   Other/All   **********************************

    async getAccessTokenInfo() {
        // Replaces GET /oauth/v1/access-tokens/{token}.
        // https://developers.hubspot.com/docs/api-reference/latest/authentication/oauth-tokens/token-introspect
        const form = new URLSearchParams({
            client_id: this.client_id,
            client_secret: this.client_secret,
            token: this.access_token,
            token_type_hint: 'access_token',
        });
        // Bypass Api._post JSON headers — introspect is form-urlencoded.
        return super._post(
            {
                url: this.baseUrl + this.URLs.tokenIntrospect,
                body: form.toString(),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json',
                },
            },
            false
        );
    }

    async getUserDetails() {
        // Replaces /integrations/v1/me + /oauth/v1/access-tokens/{token}.
        // Account details: https://developers.hubspot.com/docs/api-reference/latest/account/account-information/get-account-details
        // Token metadata: https://developers.hubspot.com/docs/api-reference/latest/authentication/manage-oauth-tokens
        const account = await this._get({
            url: this.baseUrl + this.URLs.accountDetails,
        });
        const tokenInfo = await this.getAccessTokenInfo();
        // Preserve fields Definition / callers historically read from the
        // merged legacy responses (portalId, hub_domain, app_id, …).
        return Object.assign({}, account, tokenInfo, {
            portalId: account.portalId,
            hub_domain: tokenInfo.hub_domain,
            hub_id: tokenInfo.hub_id,
        });
    }

    async getPipelineDetails(objType) {
        const options = {
            url: this.baseUrl + this.URLs.getPipelineDetails(objType),
        };
        return this._get(options);
    }

    async getBatchAssociations(fromObjectType, toObjectType, inputs) {
        const postBody = {inputs};

        const options = {
            url:
                this.baseUrl +
                this.URLs.readBatchAssociations(fromObjectType, toObjectType),
            body: postBody,
        };

        const res = await this._post(options);
        const {results} = res;
        return results;
    }

    async createBatchAssociations(fromObjectType, toObjectType, inputs) {
        const postBody = {inputs};

        const options = {
            url:
                this.baseUrl +
                this.URLs.createBatchAssociations(fromObjectType, toObjectType),
            body: postBody,
        };

        const res = await this._post(options);
        const {results} = res;
        return results;
    }

    async createBatchAssociationsDefault(fromObjectType, toObjectType, inputs) {
        const options = {
            url:
                this.baseUrl +
                this.URLs.createBatchAssociationsDefault(fromObjectType, toObjectType),
            body: {inputs},
        };

        const res = await this._post(options);
        const {results} = res;
        return results;
    }

    async deleteBatchAssociations(fromObjectType, toObjectType, inputs) {
        const options = {
            url:
                this.baseUrl +
                this.URLs.deleteBatchAssociations(fromObjectType, toObjectType),
            body: {inputs},
            returnFullRes: true,
        };

        return this._post(options);
    }

    async deleteBatchAssociationLabels(fromObjectType, toObjectType, inputs) {
        const options = {
            url:
                this.baseUrl +
                this.URLs.deleteBatchAssociationLabels(fromObjectType, toObjectType),
            body: {inputs},
            returnFullRes: true,
        };

        return this._post(options);
    }

    async _propertiesList(objType) {
        const props = await this.listProperties(objType);
        let propsString = '';
        for (let i = 0; i < props.results.length; i++) {
            propsString += `${props.results[i].name},`;
        }
        propsString = propsString.slice(0, propsString.length - 1);
        return propsString;
    }

    async getAssociationLabels(fromObjType, toObjType) {
        const options = {
            url: this.baseUrl + this.URLs.associationLabels(fromObjType, toObjType),
        };
        return this._get(options);
    }

    async createAssociationLabel(fromObjType, toObjType, label) {
        const options = {
            url: this.baseUrl + this.URLs.associationLabels(fromObjType, toObjType),
            body: label
        };
        return this._post(options);
    }

    async deleteAssociationLabel(fromObjType, toObjType, associationTypeId) {
        const options = {
            url: this.baseUrl + this.URLs.associationLabels(fromObjType, toObjType) + `/${associationTypeId}`,
        };
        return this._delete(options, false);
    }

    async searchLists(query = "", offset = 0, count = 500, additionalProperties = []) {
        const options = {
            url: this.baseUrl + this.URLs.listSearch,
            body: {
                query,
                offset,
                count,
                additionalProperties
            },
        };
        return this._post(options);
    }

    async getListById(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
        };
        return this._get(options);
    }

    async createList(name, objectTypeId, processingType = 'MANUAL', listFolderId = null) {
        const options = {
            url: this.baseUrl + this.URLs.lists,
            body: {
                name,
                objectTypeId,
                processingType,
                listFolderId
            },
        };
        return this._post(options);
    }

    async deleteList(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
        };
        return this._delete(options);
    }

    async removeAllListMembers(listId) {
        const options = {
            url: this.baseUrl + this.URLs.listMemberships(listId),
        };
        return this._delete(options);
    }

    async addAndRemoveFromList(listId, idsToAdd, idsToRemove)  {
        const options = {
            url: this.baseUrl + this.URLs.listMembershipsAddRemove(listId),
            body: {
                "recordIdsToAdd": idsToAdd,
                "recordIdsToRemove": idsToRemove
            },
        };
        return this._put(options);
    }

    async addToList(listId, recordIds)  {
        return this.addAndRemoveFromList(listId, recordIds, []);
    }

    async removeFromList(listId, recordIds)  {
        return this.addAndRemoveFromList(listId, [], recordIds);
    }

    // **************************   Webhook Subscriptions   **********************************
    //
    // App-level Webhooks v3 Subscriptions API. Auth is the developer-account
    // API key (Bearer), distinct from the per-portal OAuth flow the rest of
    // this Api class uses. Endpoints accept { appId, developerApiKey } so
    // callers control identity per-call without mutating Api instance state.

    async listWebhookSubscriptions({ appId, developerApiKey }) {
        const response = await this._developerFetch(
            this.baseUrl + this.URLs.webhookSubscriptions(appId),
            { method: 'GET' },
            developerApiKey
        );
        await this._requireOk(response, 'listWebhookSubscriptions');
        const body = await response.json();
        return body.results ?? [];
    }

    async createWebhookSubscription({ appId, developerApiKey, eventType, propertyName }) {
        const body = propertyName
            ? { eventType, propertyName, active: true }
            : { eventType, active: true };
        const response = await this._developerFetch(
            this.baseUrl + this.URLs.webhookSubscriptions(appId),
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            },
            developerApiKey
        );
        if (response.status === 409) {
            return { status: 409, data: await this._safeJson(response) };
        }
        await this._requireOk(response, 'createWebhookSubscription');
        return { status: response.status, data: await response.json() };
    }

    async deleteWebhookSubscription({ appId, developerApiKey, subscriptionId }) {
        const response = await this._developerFetch(
            this.baseUrl + this.URLs.webhookSubscriptionById(appId, subscriptionId),
            { method: 'DELETE' },
            developerApiKey
        );
        if (response.status === 404) return;
        await this._requireOk(response, 'deleteWebhookSubscription');
    }

    async _developerFetch(url, init, developerApiKey) {
        return fetch(url, {
            ...init,
            headers: {
                ...init.headers,
                Authorization: `Bearer ${developerApiKey}`,
            },
        });
    }

    async _requireOk(response, operation) {
        if (response.ok) return;
        const detail = await this._safeText(response);
        throw new Error(
            `HubSpot ${operation} failed: ${response.status} ${detail}`
        );
    }

    async _safeJson(response) {
        try {
            return await response.json();
        } catch {
            return {};
        }
    }

    async _safeText(response) {
        try {
            return await response.text();
        } catch {
            return '';
        }
    }
}

module.exports = {Api};
