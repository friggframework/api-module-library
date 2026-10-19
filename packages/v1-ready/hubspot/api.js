const {OAuth2Requester, get} = require('@friggframework/core');

const crypto = require('crypto');

// ---- webhook signature helpers (used by verifyWebhookSignature) ------------
function whHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    const want = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === want) {
            const v = headers[key];
            return Array.isArray(v) ? v[0] : v;
        }
    }
    return undefined;
}

/** The bytes the vendor signed: rawBody when given, else the body (JSON-stringified if parsed). */
function whPayload(rawBody, body) {
    if (rawBody !== undefined && rawBody !== null) {
        return Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
    }
    if (body === undefined || body === null) return Buffer.alloc(0);
    if (Buffer.isBuffer(body)) return body;
    if (typeof body === 'string') return Buffer.from(body, 'utf8');
    return Buffer.from(JSON.stringify(body), 'utf8');
}

/** Constant-time string comparison; false (not a throw) when the lengths differ. */
function whSafeEqual(a, b) {
    const x = Buffer.from(String(a), 'utf8');
    const y = Buffer.from(String(b), 'utf8');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function whNowMs(now) {
    if (now instanceof Date) return now.getTime();
    return typeof now === 'number' ? now : Date.now();
}

function whHmac(key, parts, encoding) {
    const h = crypto.createHmac('sha256', key);
    for (const p of parts) h.update(p);
    return h.digest(encoding);
}

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.webhookSecret = (params && params.webhookSecret) || null;
        this.webhookUrl = (params && params.webhookUrl) || null;
        // The majority of the properties for OAuth are default loaded by OAuth2Requester.
        // This includes the `client_id`, `client_secret`, `scopes`, and `redirect_uri`.
        this.baseUrl = 'https://api.hubapi.com';

        this.URLs = {
            authorization: '/oauth/authorize',
            access_token: '/oauth/v1/token',
            contacts: '/crm/v3/objects/contacts',
            contactById: (contactId) => `/crm/v3/objects/contacts/${contactId}`,
            getBatchContactsById: '/crm/v3/objects/contacts/batch/read',
            companies: '/crm/v3/objects/companies',
            companyById: (compId) => `/crm/v3/objects/companies/${compId}`,
            companySearch: '/crm/v3/objects/companies/search',
            getBatchCompaniesById: '/crm/v3/objects/companies/batch/read',
            createTimelineEvent: '/crm/v3/timeline/events',
            userDetails: '/integrations/v1/me',
            domain: (accessToken) => `/oauth/v1/access-tokens/${accessToken}`,
            properties: (objType) => `/crm/v3/properties/${objType}`,
            propertiesByName: (objType, propName) =>
                `/crm/v3/properties/${objType}/${propName}`,
            deals: '/crm/v3/objects/deals',
            dealById: (dealId) => `/crm/v3/objects/deals/${dealId}`,
            searchDeals: '/crm/v3/objects/deals/search',
            readBatchAssociations: (fromObjectType, toObjectType) =>
                `/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/read`,
            createBatchAssociations: (fromObjectType, toObjectType) =>
                `/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/create`,
            createBatchAssociationsDefault: (fromObjectType, toObjectType) =>
                `/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/associate/default`,
            deleteBatchAssociations: (fromObjectType, toObjectType) =>
                `/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/archive`,
            deleteBatchAssociationLabels: (fromObjectType, toObjectType) =>
                `/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/labels/archive`,
            v1DealInfo: (dealId) => `/deals/v1/deal/${dealId}`,
            getPipelineDetails: (objType) => `/crm/v3/pipelines/${objType}`,
            getOwnerById: (ownerId) => `/owners/v2/owners/${ownerId}`,
            contactList: '/contacts/v1/lists',
            contactListById: (listId) => `/contacts/v1/lists/${listId}`,
            customObjectSchemas: '/crm/v3/schemas',
            customObjectSchemaByObjectType: (objectType) =>
                `/crm/v3/schemas/${objectType}`,
            customObjects: (objectType) => `/crm/v3/objects/${objectType}`,
            customObjectsSearch: (objectType) => `/crm/v3/objects/${objectType}/search`,
            customObjectById: (objectType, objId) =>
                `/crm/v3/objects/${objectType}/${objId}`,
            bulkCreateCustomObjects: (objectType) =>
                `/crm/v3/objects/${objectType}/batch/create`,
            bulkReadCustomObjects: (objectType) =>
                `/crm/v3/objects/${objectType}/batch/read`,
            bulkUpdateCustomObjects: (objectType) =>
                `/crm/v3/objects/${objectType}/batch/update`,
            bulkArchiveCustomObjects: (objectType) =>
                `/crm/v3/objects/${objectType}/batch/archive`,
            landingPages: '/cms/v3/pages/landing-pages',
            sitePages: '/cms/v3/pages/site-pages',
            blogPosts: '/cms/v3/blogs/posts',
            landingPageById: (landingPageId) => `/cms/v3/pages/landing-pages/${landingPageId}`,
            sitePageById: (sitePageId) => `/cms/v3/pages/site-pages/${sitePageId}`,
            blogPostById: (blogPostId) => `/cms/v3/blogs/posts/${blogPostId}`,
            emailTemplates: '/content/api/v2/templates',
            emailTemplateById: (templateId) => `/content/api/v2/templates/${templateId}`,
            lists: '/crm/v3/lists',
            listById: (listId) => `/crm/v3/lists/${listId}`,
            listSearch: '/crm/v3/lists/search',
            listMemberships: (listId) => `/crm/v3/lists/${listId}/memberships`,
            listMembershipsAddRemove: (listId) => `/crm/v3/lists/${listId}/memberships/add-and-remove`,
            associations: (fromObject, toObject) => `/crm/v4/associations/${fromObject}/${toObject}`,
            associationLabels: (fromObject, toObject) => `/crm/v4/associations/${fromObject}/${toObject}/labels`,
            recordAssociations: (fromObject, objectId, toObject) =>
                `/crm/v4/objects/${fromObject}/${objectId}/associations/${toObject}`,
            contactsSearch: '/crm/v3/objects/contacts/search',
            contactsBatchUpsert: '/crm/v3/objects/contacts/batch/upsert',
            tasks: '/crm/v3/objects/tasks',
            taskById: (taskId) => `/crm/v3/objects/tasks/${taskId}`,
            tasksSearch: '/crm/v3/objects/tasks/search',
            calls: '/crm/v3/objects/calls',
            notes: '/crm/v3/objects/notes',
            owners: '/crm/v3/owners',
            pipelineById: (objType, pipelineId) => `/crm/v3/pipelines/${objType}/${pipelineId}`,
            subscriptionDefinitions: '/communication-preferences/v3/definitions',
            unsubscribe: '/communication-preferences/v3/unsubscribe',

        };

        this.authorizationUri = encodeURI(
            `https://app.hubspot.com/oauth/authorize?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&scope=${this.scope}&state=${this.state}`
        );
        this.tokenUri = 'https://api.hubapi.com/oauth/v1/token';

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

    /**
     * Search contacts (POST /crm/v3/objects/contacts/search). Filters are ANDed in one filterGroup.
     * @param {{email?: string, phone?: string, limit?: number, lastContactedBefore?: string|number|Date, properties?: string[], after?: string}} [params]
     * lastContactedBefore filters on `notes_last_contacted` (LT). phone matches `phone` exactly.
     */
    async searchContacts(params = {}) {
        const {email, phone, lastContactedBefore, properties, after} = params;
        const filters = [];
        if (email) filters.push({propertyName: 'email', operator: 'EQ', value: email});
        if (phone) filters.push({propertyName: 'phone', operator: 'EQ', value: phone});
        if (lastContactedBefore !== undefined && lastContactedBefore !== null) {
            const ts = new Date(lastContactedBefore).getTime();
            filters.push({propertyName: 'notes_last_contacted', operator: 'LT', value: String(ts)});
        }
        const body = {
            filterGroups: filters.length ? [{filters}] : [],
            limit: get(params, 'limit', 10),
        };
        if (properties && properties.length) body.properties = properties;
        if (after) body.after = after;
        return this._post({url: this.baseUrl + this.URLs.contactsSearch, body});
    }

    /**
     * Create-or-update a contact keyed on email (POST /crm/v3/objects/contacts/batch/upsert, idProperty=email).
     * Returns the single upserted contact. Note HubSpot does not support partial upserts when idProperty is email.
     */
    async upsertContactByEmail(email, properties) {
        const options = {
            url: this.baseUrl + this.URLs.contactsBatchUpsert,
            body: {
                inputs: [{idProperty: 'email', id: email, properties: {...properties, email}}],
            },
        };
        const res = await this._post(options);
        return res && Array.isArray(res.results) ? res.results[0] : res;
    }

    /** Ids associated with a record (GET /crm/v4/objects/{from}/{id}/associations/{to}), paged to exhaustion. */
    async _listAssociatedIds(fromType, fromId, toType) {
        const ids = [];
        let after;
        do {
            const query = {limit: 500};
            if (after) query.after = after;
            const res = await this._get({
                url: this.baseUrl + this.URLs.recordAssociations(fromType, fromId, toType),
                query,
            });
            for (const r of get(res, 'results', [])) ids.push(String(r.toObjectId));
            after = get(res, 'paging.next.after', null);
        } while (after);
        return ids;
    }

    /** Full records for ids (POST /crm/v3/objects/{type}/batch/read), chunked at 100. */
    async _batchReadObjects(objectType, ids, properties) {
        const out = [];
        for (let i = 0; i < ids.length; i += 100) {
            const res = await this._post({
                url: `${this.baseUrl}/crm/v3/objects/${objectType}/batch/read`,
                body: {
                    inputs: ids.slice(i, i + 100).map((id) => ({id})),
                    properties,
                },
            });
            out.push(...get(res, 'results', []));
        }
        return out;
    }

    /**
     * Deals associated with a contact, as full deal records. open=true keeps only deals where
     * hs_is_closed is not "true"; open=false only closed ones; omitted returns all.
     */
    async listDealsForContact(contactId, open) {
        const ids = await this._listAssociatedIds('contacts', contactId, 'deals');
        if (!ids.length) return [];
        const props = await this._propertiesList('deal');
        const deals = await this._batchReadObjects('deals', ids, props.split(',').concat('hs_is_closed'));
        if (open === undefined || open === null) return deals;
        return deals.filter((d) => (String(get(d, 'properties.hs_is_closed')) === 'true') === !open);
    }

    /** Contacts associated with a deal, as full contact records. */
    async listContactsForDeal(dealId) {
        const ids = await this._listAssociatedIds('deals', dealId, 'contacts');
        if (!ids.length) return [];
        const props = await this._propertiesList('contact');
        return this._batchReadObjects('contacts', ids, props.split(','));
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
        const options = {
            url: this.baseUrl + this.URLs.v1DealInfo(dealId),
            query: {includePropertyVersions: true},
        };
        const res = await this._get(options);
        return res.properties.dealstage.versions;
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
        const options = {
            url: this.baseUrl + this.URLs.contactList,
        };

        return this._get(options);
    }

    async updateContactList(listId, body) {
        const options = {
            url: this.baseUrl + this.URLs.contactListById(listId),
            body,
        };
        return this._post(options);
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

    // **************************   Engagements (tasks, calls, notes)   ***************

    /** Build an engagement create body with HUBSPOT_DEFINED associations. */
    _engagementBody(properties, assocs) {
        const body = {properties};
        const associations = assocs
            .filter(([id]) => id !== undefined && id !== null && id !== '')
            .map(([id, typeId]) => ({
                to: {id: String(id)},
                types: [{associationCategory: 'HUBSPOT_DEFINED', associationTypeId: typeId}],
            }));
        if (associations.length) body.associations = associations;
        return body;
    }

    /** Task (POST /crm/v3/objects/tasks); task->contact association type 204. */
    async createTask(properties, contactId) {
        return this._post({
            url: this.baseUrl + this.URLs.tasks,
            body: this._engagementBody(properties, [[contactId, 204]]),
        });
    }

    /** Call (POST /crm/v3/objects/calls); call->contact association type 194. */
    async createCallEngagement(properties, contactId) {
        return this._post({
            url: this.baseUrl + this.URLs.calls,
            body: this._engagementBody(properties, [[contactId, 194]]),
        });
    }

    /** Note (POST /crm/v3/objects/notes); note->contact 202, note->deal 214. */
    async createNote(properties, contactId, dealId) {
        return this._post({
            url: this.baseUrl + this.URLs.notes,
            body: this._engagementBody(properties, [[contactId, 202], [dealId, 214]]),
        });
    }

    async getTaskById(id, properties) {
        const options = {url: this.baseUrl + this.URLs.taskById(id)};
        if (properties && properties.length) options.query = {properties: properties.join(',')};
        return this._get(options);
    }

    async updateTask(id, properties) {
        return this._patch({
            url: this.baseUrl + this.URLs.taskById(id),
            body: {properties},
        });
    }

    /**
     * Search tasks (POST /crm/v3/objects/tasks/search). dueBefore filters hs_timestamp (the task due date) LT;
     * status -> hs_task_status EQ; ownerId -> hubspot_owner_id EQ.
     */
    async searchTasks(params = {}) {
        const {dueBefore, status, ownerId, properties, after} = params;
        const filters = [];
        if (dueBefore !== undefined && dueBefore !== null) {
            filters.push({propertyName: 'hs_timestamp', operator: 'LT', value: String(new Date(dueBefore).getTime())});
        }
        if (status) filters.push({propertyName: 'hs_task_status', operator: 'EQ', value: status});
        if (ownerId) filters.push({propertyName: 'hubspot_owner_id', operator: 'EQ', value: String(ownerId)});
        const body = {
            filterGroups: filters.length ? [{filters}] : [],
            limit: get(params, 'limit', 10),
        };
        if (properties && properties.length) body.properties = properties;
        if (after) body.after = after;
        return this._post({url: this.baseUrl + this.URLs.tasksSearch, body});
    }

    // **************************   Owners   **********************************

    async getOwnerById(ownerId) {
        const options = {
            url: this.baseUrl + this.URLs.getOwnerById(ownerId),
        };
        return this._get(options);
    }

    /** All owners (GET /crm/v3/owners), paged to exhaustion; returns the array of owners. */
    async listOwners() {
        const owners = [];
        let after;
        do {
            const query = {limit: 500};
            if (after) query.after = after;
            const res = await this._get({url: this.baseUrl + this.URLs.owners, query});
            owners.push(...get(res, 'results', []));
            after = get(res, 'paging.next.after', null);
        } while (after);
        return owners;
    }

    /** Owner by email (GET /crm/v3/owners?email=); null when none matches. */
    async getOwnerByEmail(email) {
        const res = await this._get({url: this.baseUrl + this.URLs.owners, query: {email}});
        return get(res, 'results.0', null);
    }

    // **************************   Timeline Events   **********************************

    async createTimelineEvent(
        objId,
        data,
        eventTemplateId = process.env.HUBSPOT_TIMELINE_EVENT_TEMPLATE_ID
    ) {
        /*
        Example data:
        {
          "activityName": "Custom property for deal"
        }
         */
        const body = {
            eventTemplateId,
            objectId: objId,
            tokens: data.tokens,
            extraData: data.extraData,
        };
        return this._post(this.URLs.createTimelineEvent, body);
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
        const options = {
            url: `${this.baseUrl}${this.URLs.emailTemplateById(objId)}`,
            body: body,
        };
        return this._put(options);
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

    async getUserDetails() {
        const res1 = await this._get({
            url: this.baseUrl + this.URLs.userDetails,
        });
        const url2 = this.URLs.domain(this.access_token);
        const res2 = await this._get({url: this.baseUrl + url2});
        return Object.assign(res1, res2);
    }

    async getPipelineDetails(objType) {
        const options = {
            url: this.baseUrl + this.URLs.getPipelineDetails(objType),
        };
        return this._get(options);
    }

    /**
     * Deal stages (GET /crm/v3/pipelines/deals[/{pipelineId}]). Each stage carries its pipelineId.
     * With no pipelineId, stages of every deal pipeline are flattened.
     */
    async listDealStages(pipelineId) {
        if (pipelineId) {
            const p = await this._get({url: this.baseUrl + this.URLs.pipelineById('deals', pipelineId)});
            return get(p, 'stages', []).map((st) => ({pipelineId: p.id, ...st}));
        }
        const res = await this.getPipelineDetails('deals');
        return get(res, 'results', []).flatMap((p) => get(p, 'stages', []).map((st) => ({pipelineId: p.id, ...st})));
    }

    // **************************   Email subscriptions   ************************

    /** Subscription types (GET /communication-preferences/v3/definitions); returns the definitions array. */
    async listSubscriptionDefinitions() {
        const res = await this._get({url: this.baseUrl + this.URLs.subscriptionDefinitions});
        return get(res, 'subscriptionDefinitions', get(res, 'results', []));
    }

    /**
     * Unsubscribe an email from one subscription type (POST /communication-preferences/v3/unsubscribe).
     * Returns the resulting PublicSubscriptionStatus. Requires communication_preferences.write.
     */
    async unsubscribeEmail(emailAddress, subscriptionId, legalBasis, legalBasisExplanation) {
        const body = {emailAddress, subscriptionId: String(subscriptionId)};
        if (legalBasis) body.legalBasis = legalBasis;
        if (legalBasisExplanation) body.legalBasisExplanation = legalBasisExplanation;
        return this._post({url: this.baseUrl + this.URLs.unsubscribe, body});
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



    /**
     * Verify a HubSpot webhook delivery (signature v3).
     * Docs: https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/request-validation
     *
     * HMAC-SHA256, base64, over METHOD + URI + body + X-HubSpot-Request-Timestamp, keyed with the app's
     * client secret; deliveries older than 5 minutes are rejected. The runtime does not pass the request
     * URL, so give it as `url` or configure `webhookUrl` / HUBSPOT_WEBHOOK_URL (the public URL HubSpot
     * calls). Prefer `rawBody`: HubSpot signs the exact bytes it sent.
     * Never throws; returns true only for a genuine delivery.
     */
    async verifyWebhookSignature({ headers, body, rawBody, method, url, uri, now } = {}) {
        try {
            const secret =
                this.webhookSecret ||
                this.client_secret ||
                process.env.HUBSPOT_CLIENT_SECRET;
            if (!secret) return false;
            const signature = whHeader(headers, 'x-hubspot-signature-v3');
            const timestamp = whHeader(headers, 'x-hubspot-request-timestamp');
            if (!signature || !timestamp) return false;
            const ts = Number(timestamp);
            if (!Number.isFinite(ts)) return false;
            if (Math.abs(whNowMs(now) - ts) > 5 * 60 * 1000) return false;
            const requestUri =
                url || uri || this.webhookUrl || process.env.HUBSPOT_WEBHOOK_URL;
            if (!requestUri) return false;
            // Decode only the characters HubSpot lists (not the "?" that starts the query), drop any fragment.
            const decodedUri = String(requestUri)
                .split('#')[0]
                .replace(/%(3A|2F|3F|40|21|24|27|28|29|2A|2C|3B)/gi, (m) =>
                    decodeURIComponent(m)
                );
            const expected = whHmac(
                secret,
                [
                    `${String(method || 'POST').toUpperCase()}${decodedUri}`,
                    whPayload(rawBody, body),
                    String(timestamp),
                ],
                'base64'
            );
            return whSafeEqual(expected, signature);
        } catch (e) {
            return false;
        }
    }
}

module.exports = {Api};
