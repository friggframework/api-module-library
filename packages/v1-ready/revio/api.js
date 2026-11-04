const { BasicAuthRequester, ModuleConstants, get } = require('@friggframework/core');
const formatPatchBody = require('./formatPatchBody');

/**
 * Rev.io REST API client.
 *
 * Rev.io (rev.io) is a usage-based billing and customer management platform.
 * Auth is HTTP Basic: Base64(`username@client_code:password`) in the
 * `Authorization` header. OAuth 2.0 is documented as in testing and not yet
 * available for general use.
 *
 *   - Auth docs: https://developers.rev.io/docs/basic-authentication
 *   - Base URL (Getting Started): https://restapi.rev.io/v1
 *   - Reference: https://developers.rev.io/reference
 *
 * The canonical machine-readable contract lives in ./revio.openapi.yaml — this
 * client mirrors it 1:1 (one method per operationId). Keep them in sync.
 */
class Api extends BasicAuthRequester {
    constructor(params = {}) {
        super(params);

        this.username = get(params, 'username', null);
        this.password = get(params, 'password', null);
        this.client_code = get(params, 'client_code', null);

        // Getting Started / Basic Authentication use restapi.rev.io.
        // Allow override for tenants that resolve on api.revioapi.com.
        this.baseUrl =
            get(params, 'base_url', null) || 'https://restapi.rev.io/v1';

        this.URLs = {
            billProfiles: '/BillProfiles',
            billProfileById: (id) => `/BillProfiles/${id}`,
            customers: '/Customers',
            customerById: (id) => `/Customers/${id}`,
            contacts: '/Contacts',
            contactById: (id) => `/Contacts/${id}`,
            bills: '/Bills',
            billById: (id) => `/Bills/${id}`,
            payments: '/Payments',
            paymentById: (id) => `/Payments/${id}`,
            charges: '/Charges',
            chargeById: (id) => `/Charges/${id}`,
            webhookReceivers: '/WebhookReceivers',
            webhookReceiverById: (id) => `/WebhookReceivers/${id}`,
            webhookReceiverActivate: (id) =>
                `/WebhookReceivers/${id}/activate`,
            webhookSubscriptions: '/WebhookSubscriptions',
            webhookSubscriptionById: (id) => `/WebhookSubscriptions/${id}`,
        };
    }

    /**
     * Rev.io Basic auth is `username@client_code:password`, not the plain
     * `username:password` BasicAuthRequester builds by default.
     * Docs: https://developers.rev.io/docs/basic-authentication
     */
    async addAuthHeaders(headers = {}) {
        if (this.username && this.client_code && this.password) {
            const token = Buffer.from(
                `${this.username}@${this.client_code}:${this.password}`
            ).toString('base64');
            headers['Authorization'] = `Basic ${token}`;
        }
        return headers;
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.basic,
            data: {
                jsonSchema: {
                    type: 'object',
                    required: ['username', 'password', 'client_code'],
                    properties: {
                        username: {
                            type: 'string',
                            title: 'Username',
                        },
                        password: {
                            type: 'string',
                            title: 'Password',
                        },
                        client_code: {
                            type: 'string',
                            title: 'Client Code',
                        },
                    },
                },
                uiSchema: {
                    username: {
                        'ui:help':
                            'Rev.io login name (not an email — an extra @ breaks Basic auth). Prefer a dedicated API user under Settings → Users.',
                        'ui:placeholder': 'api.user',
                    },
                    password: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Password for that user. Combined as username@client_code:password in the Basic Authorization header.',
                    },
                    client_code: {
                        'ui:help':
                            'Your Rev.io client / instance code (the part after @ in the Basic username).',
                        'ui:placeholder': 'YourClientCode',
                    },
                },
            },
        };
    }

    // ---- Bill profiles (identity / auth check) -----------------------------

    /** Search bill profiles. GET /BillProfiles */
    async listBillProfiles(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.billProfiles,
            query,
        });
    }

    /** View a bill profile. GET /BillProfiles/{id} */
    async getBillProfile(id) {
        return this._get({
            url: this.baseUrl + this.URLs.billProfileById(id),
        });
    }

    // ---- Customers ---------------------------------------------------------

    /** Search customers. GET /Customers */
    async listCustomers(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.customers,
            query,
        });
    }

    /** View a customer. GET /Customers/{id} */
    async getCustomer(id) {
        return this._get({
            url: this.baseUrl + this.URLs.customerById(id),
        });
    }

    /** Create a customer. POST /Customers */
    async createCustomer(body) {
        return this._post({
            url: this.baseUrl + this.URLs.customers,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Partially update a customer. PATCH /Customers/{id}
     * Body is a plain object; converted to JSON Patch replace ops.
     */
    async updateCustomer(id, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.customerById(id),
            headers: { 'Content-Type': 'application/json-patch+json' },
            body: formatPatchBody('/', body),
        });
    }

    // ---- Contacts ----------------------------------------------------------

    /** Search contacts. GET /Contacts */
    async listContacts(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.contacts,
            query,
        });
    }

    /** View a contact. GET /Contacts/{id} */
    async getContact(id) {
        return this._get({
            url: this.baseUrl + this.URLs.contactById(id),
        });
    }

    /** Create a contact. POST /Contacts */
    async createContact(body) {
        return this._post({
            url: this.baseUrl + this.URLs.contacts,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Partially update a contact. PATCH /Contacts/{id}
     * Body is a plain object; converted to JSON Patch replace ops.
     */
    async updateContact(id, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.contactById(id),
            headers: { 'Content-Type': 'application/json-patch+json' },
            body: formatPatchBody('/', body),
        });
    }

    /** Delete a contact. DELETE /Contacts/{id} */
    async deleteContact(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.contactById(id),
        });
    }

    // ---- Bills -------------------------------------------------------------

    /** Search bills. GET /Bills */
    async listBills(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.bills,
            query,
        });
    }

    /** View a bill. GET /Bills/{id} */
    async getBill(id) {
        return this._get({
            url: this.baseUrl + this.URLs.billById(id),
        });
    }

    // ---- Payments ----------------------------------------------------------

    /** Search payments. GET /Payments */
    async listPayments(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.payments,
            query,
        });
    }

    /** View a payment. GET /Payments/{id} */
    async getPayment(id) {
        return this._get({
            url: this.baseUrl + this.URLs.paymentById(id),
        });
    }

    /**
     * Create a payment. POST /Payments
     * Body fields (official PostModels.Payments.Payment): payment_account_id?,
     * bill_id?, customer_id, amount, reference_number?, received_date?
     */
    async createPayment(body) {
        return this._post({
            url: this.baseUrl + this.URLs.payments,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Charges -----------------------------------------------------------

    /** Search charges. GET /Charges */
    async listCharges(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.charges,
            query,
        });
    }

    /** View a charge. GET /Charges/{id} */
    async getCharge(id) {
        return this._get({
            url: this.baseUrl + this.URLs.chargeById(id),
        });
    }

    // ---- Webhook receivers -------------------------------------------------

    /** Search webhook receivers. GET /WebhookReceivers */
    async listWebhookReceivers(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookReceivers,
            query,
        });
    }

    /** View a webhook receiver. GET /WebhookReceivers/{id} */
    async getWebhookReceiver(id) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookReceiverById(id),
        });
    }

    /**
     * Register a webhook receiver. POST /WebhookReceivers
     * Body: { url (required), description?, require_xhook_header_confirmation_flag? }
     */
    async createWebhookReceiver(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookReceivers,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** Delete a webhook receiver. DELETE /WebhookReceivers/{id} */
    async deleteWebhookReceiver(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookReceiverById(id),
        });
    }

    /**
     * Activate a registered receiver. POST /WebhookReceivers/{id}/activate
     * Pass the confirmation code from the X-Hook-Secret header Rev.io sent to
     * the receiver URL. Docs: https://developers.rev.io/docs/webhook-receivers
     */
    async activateWebhookReceiver(id, confirmationCode) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookReceiverActivate(id),
            headers: {
                'Content-Type': 'application/json',
                'X-Hook-Secret': confirmationCode,
            },
            body: {},
        });
    }

    // ---- Webhook subscriptions ---------------------------------------------

    /** Search webhook subscriptions. GET /WebhookSubscriptions */
    async listWebhookSubscriptions(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookSubscriptions,
            query,
        });
    }

    /** View a webhook subscription. GET /WebhookSubscriptions/{id} */
    async getWebhookSubscription(id) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookSubscriptionById(id),
        });
    }

    /**
     * Create a webhook subscription. POST /WebhookSubscriptions
     * Body: { webhook_receiver_id, event_type }
     * event_type enum values are listed under WebhookSubscriptions in the
     * API Explorer (e.g. CUSTOMER_CREATED, BILL_CREATED, PAYMENT_CREATED).
     */
    async createWebhookSubscription(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookSubscriptions,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** Delete a webhook subscription. DELETE /WebhookSubscriptions/{id} */
    async deleteWebhookSubscription(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookSubscriptionById(id),
        });
    }

    // ---- Auth check --------------------------------------------------------

    /**
     * Lightweight authenticated request used to validate credentials.
     * Listing bill profiles is the Getting Started identity probe and returns
     * 200 for valid credentials.
     */
    async testAuth() {
        return this.listBillProfiles({
            'search.page_size': 1,
            'search.page': 1,
        });
    }
}

module.exports = { Api };
