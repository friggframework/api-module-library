const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * JobTread Pave API client.
 *
 * Auth: grant key placed in the JSON body at `query.$.grantKey`
 *   (not an HTTP header). Create a grant under
 *   Settings → Integrations → API → Grants.
 *
 * Transport: every call is `POST https://api.jobtread.com/pave` with
 * `{ "query": { "$": { "grantKey": "..." }, ... } }`.
 *
 * Pave is a GraphQL-like JSON query language. Scalar fields are selected with
 * `{}`; arguments live under `$`. The public schema is introspectable without
 * credentials via `{ "query": { "schema": { "$": { "path": "root" } } } }`.
 *
 * Sources (official):
 *   https://www.jobtread.com/integrations/open-api
 *   https://app.jobtread.com/docs
 *   https://api.jobtread.com/pave  (live schema via `schema` root field)
 */
const ACCOUNT_FIELDS = {
    id: {},
    name: {},
    type: {},
    isTaxable: {},
    archivedAt: {},
    createdAt: {},
    qboId: {},
};

const JOB_FIELDS = {
    id: {},
    name: {},
    number: {},
    description: {},
    closedOn: {},
    createdAt: {},
    projectedCost: {},
    projectedPrice: {},
    actualCost: {},
    location: { id: {}, name: {} },
};

const LOCATION_FIELDS = {
    id: {},
    name: {},
    address: {},
    street: {},
    city: {},
    state: {},
    postalCode: {},
    country: {},
    formattedAddress: {},
    createdAt: {},
};

const DOCUMENT_FIELDS = {
    id: {},
    name: {},
    number: {},
    fullName: {},
    type: {},
    status: {},
    subject: {},
    issueDate: {},
    dueDate: {},
    price: {},
    balance: {},
    createdAt: {},
    job: { id: {}, name: {} },
    account: { id: {}, name: {} },
};

const WEBHOOK_FIELDS = {
    id: {},
    url: {},
    eventTypes: {},
    error: {},
    createdAt: {},
};

class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        // Grant key lives in the Pave body, not a header. We still use
        // ApiKeyRequester for credential storage / isAuthenticated(), and
        // override addAuthHeaders so nothing is injected into headers.
        this.api_key_name = 'X-JobTread-Unused';
        this.grant_key =
            get(params, 'grant_key', null) ||
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            get(params, 'apiKey', null);
        this.api_key = this.grant_key;

        this.baseUrl = 'https://api.jobtread.com/pave';
    }

    /**
     * JobTread authenticates via the request body. Do not emit an auth header.
     */
    async addAuthHeaders(headers) {
        return headers || {};
    }

    setGrantKey(grantKey) {
        this.grant_key = grantKey;
        this.api_key = grantKey;
        if (typeof this.setApiKey === 'function') {
            this.setApiKey(grantKey);
        }
    }

    // ---- Pave transport ----------------------------------------------------

    /**
     * POST a Pave `query` object. Injects `query.$.grantKey` when a grant key
     * is configured. Returns the JSON response body as-is (Pave does not wrap
     * results in a GraphQL-style `{ data }` envelope).
     *
     * @param {object} query - Pave query root (without grantKey; injected here)
     * @param {object} [dollarExtras] - Extra keys merged into `query.$`
     *   (e.g. `notify`, `timeZone`, `viaUserId` per schema `root.$`).
     */
    async pave(query = {}, dollarExtras = {}) {
        const bodyQuery = { ...query };
        const dollar = {
            ...(bodyQuery.$ && typeof bodyQuery.$ === 'object'
                ? bodyQuery.$
                : {}),
            ...dollarExtras,
        };
        if (this.grant_key) {
            dollar.grantKey = this.grant_key;
        }
        if (Object.keys(dollar).length) {
            bodyQuery.$ = dollar;
        } else {
            delete bodyQuery.$;
        }

        return this._post({
            url: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: { query: bodyQuery },
        });
    }

    /**
     * Connection-list arguments shared by organization.* list fields.
     * Schema: page, size, where, sortBy, with, expressions, group.
     */
    _listArgs(params = {}) {
        const args = {};
        if (params.size !== undefined && params.size !== null) {
            args.size = params.size;
        }
        if (params.page !== undefined && params.page !== null) {
            args.page = params.page;
        }
        if (params.where !== undefined && params.where !== null) {
            args.where = params.where;
        }
        if (params.sortBy !== undefined && params.sortBy !== null) {
            args.sortBy = params.sortBy;
        }
        if (params.with !== undefined && params.with !== null) {
            args.with = params.with;
        }
        if (params.expressions !== undefined && params.expressions !== null) {
            args.expressions = params.expressions;
        }
        if (params.group !== undefined && params.group !== null) {
            args.group = params.group;
        }
        return args;
    }

    _requireOrganizationId(params = {}) {
        const organizationId =
            get(params, 'organizationId', null) ||
            get(params, 'organization_id', null);
        if (!organizationId) {
            throw new Error(
                'JobTread: organizationId is required for this query'
            );
        }
        return organizationId;
    }

    // ---- Auth / identity ---------------------------------------------------

    /**
     * The grant used to authenticate the request.
     * Schema: root.currentGrant → grant { id, name, expiresAt, organization, user }
     */
    async getCurrentGrant() {
        return this.pave({
            currentGrant: {
                id: {},
                name: {},
                expiresAt: {},
                createdAt: {},
                organization: { id: {}, name: {} },
                user: {
                    id: {},
                    name: {},
                    emailAddress: {},
                },
            },
        });
    }

    /**
     * Retrieve a single organization by id.
     * Schema: root.organization($: { id }) → organization
     */
    async getOrganization(organizationId) {
        return this.pave({
            organization: {
                $: { id: organizationId },
                id: {},
                name: {},
            },
        });
    }

    // ---- Accounts (customers / vendors) ------------------------------------

    /**
     * List accounts under an organization.
     * Schema: organization.accounts → { nodes, nextPage, previousPage, count }
     */
    async listAccounts(params = {}) {
        const organizationId = this._requireOrganizationId(params);
        return this.pave({
            organization: {
                $: { id: organizationId },
                accounts: {
                    $: this._listArgs(params),
                    nextPage: {},
                    previousPage: {},
                    count: {},
                    nodes: ACCOUNT_FIELDS,
                },
            },
        });
    }

    /**
     * Get a single account by id.
     * Schema: root.account($: { id }) → account
     */
    async getAccount(id) {
        return this.pave({
            account: {
                $: { id },
                ...ACCOUNT_FIELDS,
                primaryContact: { id: {}, name: {} },
                primaryLocation: { id: {}, name: {} },
            },
        });
    }

    /**
     * Create an account (customer or vendor).
     * Schema: root.createAccount($: { name, type, organizationId, ... })
     * type: accountType = customer | vendor
     * Selection after write: root.createdAccount
     */
    async createAccount(input) {
        return this.pave({
            createAccount: {
                $: input,
            },
            createdAccount: ACCOUNT_FIELDS,
        });
    }

    /**
     * Update an account.
     * Schema: root.updateAccount($: { id, ... })
     */
    async updateAccount(input) {
        return this.pave({
            updateAccount: {
                $: input,
            },
            account: ACCOUNT_FIELDS,
        });
    }

    // ---- Locations ---------------------------------------------------------

    /**
     * List locations under an organization.
     * Schema: organization.locations
     */
    async listLocations(params = {}) {
        const organizationId = this._requireOrganizationId(params);
        return this.pave({
            organization: {
                $: { id: organizationId },
                locations: {
                    $: this._listArgs(params),
                    nextPage: {},
                    previousPage: {},
                    count: {},
                    nodes: LOCATION_FIELDS,
                },
            },
        });
    }

    /**
     * Get a single location by id.
     * Schema: root.location($: { id })
     */
    async getLocation(id) {
        return this.pave({
            location: {
                $: { id },
                ...LOCATION_FIELDS,
                account: { id: {}, name: {} },
            },
        });
    }

    /**
     * Create a location (required before createJob).
     * Schema: root.createLocation($: { accountId, address?, name?, ... })
     * Selection after write: root.createdLocation
     */
    async createLocation(input) {
        return this.pave({
            createLocation: {
                $: input,
            },
            createdLocation: LOCATION_FIELDS,
        });
    }

    /**
     * Update a location.
     * Schema: root.updateLocation
     */
    async updateLocation(input) {
        return this.pave({
            updateLocation: {
                $: input,
            },
            location: LOCATION_FIELDS,
        });
    }

    // ---- Jobs --------------------------------------------------------------

    /**
     * List jobs under an organization.
     * Schema: organization.jobs
     */
    async listJobs(params = {}) {
        const organizationId = this._requireOrganizationId(params);
        return this.pave({
            organization: {
                $: { id: organizationId },
                jobs: {
                    $: this._listArgs(params),
                    nextPage: {},
                    previousPage: {},
                    count: {},
                    nodes: JOB_FIELDS,
                },
            },
        });
    }

    /**
     * Get a single job by id.
     * Schema: root.job($: { id })
     */
    async getJob(id) {
        return this.pave({
            job: {
                $: { id },
                ...JOB_FIELDS,
            },
        });
    }

    /**
     * Create a job. Schema requires `locationId` (a customer is required to
     * create a location first — see createJob description on root schema).
     * Selection after write: root.createdJob
     */
    async createJob(input) {
        return this.pave({
            createJob: {
                $: input,
            },
            createdJob: JOB_FIELDS,
        });
    }

    /**
     * Update a job.
     * Schema: root.updateJob($: { id, ... })
     */
    async updateJob(input) {
        return this.pave({
            updateJob: {
                $: input,
            },
            job: JOB_FIELDS,
        });
    }

    // ---- Documents (invoices, orders, bills, bid requests) -----------------

    /**
     * List documents under an organization.
     * Schema: organization.documents
     * documentType: bidRequest | customerInvoice | customerOrder | vendorBill | vendorOrder
     */
    async listDocuments(params = {}) {
        const organizationId = this._requireOrganizationId(params);
        return this.pave({
            organization: {
                $: { id: organizationId },
                documents: {
                    $: this._listArgs(params),
                    nextPage: {},
                    previousPage: {},
                    count: {},
                    nodes: DOCUMENT_FIELDS,
                },
            },
        });
    }

    /**
     * Get a single document by id.
     * Schema: root.document($: { id })
     */
    async getDocument(id) {
        return this.pave({
            document: {
                $: { id },
                ...DOCUMENT_FIELDS,
            },
        });
    }

    /**
     * Create a document.
     * Schema: root.createDocument($: { type, jobId, ... })
     * Selection after write: root.createdDocument
     */
    async createDocument(input) {
        return this.pave({
            createDocument: {
                $: input,
            },
            createdDocument: DOCUMENT_FIELDS,
        });
    }

    /**
     * Update a document.
     * Schema: root.updateDocument($: { id, ... })
     */
    async updateDocument(input) {
        return this.pave({
            updateDocument: {
                $: input,
            },
            document: DOCUMENT_FIELDS,
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * List webhooks under an organization.
     * Schema: organization.webhooks
     */
    async listWebhooks(params = {}) {
        const organizationId = this._requireOrganizationId(params);
        return this.pave({
            organization: {
                $: { id: organizationId },
                webhooks: {
                    $: this._listArgs(params),
                    nextPage: {},
                    previousPage: {},
                    count: {},
                    nodes: WEBHOOK_FIELDS,
                },
            },
        });
    }

    /**
     * Get a single webhook by id.
     * Schema: root.webhook($: { id })
     */
    async getWebhook(id) {
        return this.pave({
            webhook: {
                $: { id },
                ...WEBHOOK_FIELDS,
                organization: { id: {}, name: {} },
            },
        });
    }

    /**
     * Create a webhook subscription.
     * Schema: root.createWebhook($: { organizationId, url, eventTypes })
     * eventType oneOf values from the public schema (e.g. jobCreated,
     * accountUpdated, documentSent, …). Selection: root.createdWebhook
     */
    async createWebhook(input) {
        return this.pave({
            createWebhook: {
                $: input,
            },
            createdWebhook: WEBHOOK_FIELDS,
        });
    }

    /**
     * Delete a webhook.
     * Schema: root.deleteWebhook($: { id })
     */
    async deleteWebhook(id) {
        return this.pave({
            deleteWebhook: {
                $: { id },
            },
        });
    }
}

module.exports = { Api };
