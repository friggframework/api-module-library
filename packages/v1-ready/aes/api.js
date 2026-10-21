const { ApiKeyRequester, get } = require('@friggframework/core');

const REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_BASE_URL = 'https://auctionconductor.com';

/**
 * AES ConductorLink API client (Auction Conductor / Event Solutions).
 *
 * Auth: organization API key sent in the `AES_API_KEY` request header.
 * Transport: every call is HTTP POST with a JSON body (vendor convention).
 *
 * Base URL defaults to production `https://auctionconductor.com`; override via
 * constructor `baseUrl` or `AES_BASE_URL` (QA staging: `https://actestserver.com`).
 *
 * Docs: https://help.aesauctions.com/article/3tz5rgz6lo-aes-conductor-link-api-guide
 *
 * The curated contract lives in ./aes.openapi.yaml — this client mirrors it 1:1
 * (one method per operationId). Keep them in sync.
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        // ApiKeyRequester puts `headers[this.api_key_name] = this.api_key`
        this.api_key_name = 'AES_API_KEY';
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            get(params, 'apiKey', null);

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            process.env.AES_BASE_URL ||
            DEFAULT_BASE_URL;

        // Bound slow / WAF-blocked ConductorLink calls so callers do not hang.
        const baseFetch = this.fetch.bind(this);
        this.fetch = (url, opts = {}) =>
            baseFetch(url, { ...opts, timeout: REQUEST_TIMEOUT_MS });

        this.URLs = {
            // Events
            getEvent: '/API/getEvent',
            getOrganizationEvents: '/API/getOrganizationEvents',

            // Contributors
            getContributor: '/API/getContributor',
            getContributors: '/API/getContributors',
            createContributor: '/API/createContributor',
            updateContributor: '/API/updateContributor',
            deleteContributor: '/API/deleteContributor',

            // Event Contributors (event-scoped)
            getEventContributor: '/API/getEventContributor',
            createEventContributor: '/API/createEventContributor',
            updateEventContributor: '/API/updateEventContributor',
            deleteEventContributor: '/API/deleteEventContributor',
            associateEventContributors: '/API/associateEventContributors',

            // Activity & Transactions
            getActivity: '/API/getActivity',
            getSales: '/API/getSales',
            getPayments: '/API/getPayments',

            // Packages & Categories
            getPackages: '/API/getPackages',
            getPackageCategories: '/API/getPackageCategories',

            // Post-Event
            lockEvent: '/API/lockEvent',
        };
    }

    _postJson(path, body = {}) {
        return this._post({
            url: this.baseUrl + path,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Parse AES Microsoft JSON date strings (`/Date(ms)/`) into Date objects.
     * Returns null when the value is missing or not in that form.
     */
    static parseAESDate(dateStr) {
        if (!dateStr) return null;
        const match = String(dateStr).match(/\/Date\((\d+)\)\//);
        if (!match) return null;
        return new Date(parseInt(match[1], 10));
    }

    // ---- Events ------------------------------------------------------------

    /** POST /API/getEvent — resolve event metadata for an event_id. */
    async getEvent(eventId) {
        return this._postJson(this.URLs.getEvent, { event_id: eventId });
    }

    /** POST /API/getOrganizationEvents — list events for the API key's org. */
    async getOrganizationEvents() {
        return this._postJson(this.URLs.getOrganizationEvents, {});
    }

    // ---- Contributors ------------------------------------------------------

    /** POST /API/getContributor */
    async getContributor(contributorId) {
        return this._postJson(this.URLs.getContributor, {
            contributor_id: contributorId,
        });
    }

    /**
     * POST /API/getContributors — all contributors for an event.
     * Documented return fields include event_contributor_id, contributor_id,
     * first_name, last_name, email, company, cell, bidder_number, etc.
     */
    async getContributors(eventId) {
        return this._postJson(this.URLs.getContributors, {
            event_id: eventId,
        });
    }

    /**
     * POST /API/createContributor
     * Documented sample fields: first_name, last_name, email, company, address*,
     * city, state, zip, phone, cell, title, website, salutation, email_opt, …
     */
    async createContributor(data) {
        return this._postJson(this.URLs.createContributor, data);
    }

    /** POST /API/updateContributor */
    async updateContributor(data) {
        return this._postJson(this.URLs.updateContributor, data);
    }

    /** POST /API/deleteContributor */
    async deleteContributor(contributorId) {
        return this._postJson(this.URLs.deleteContributor, {
            contributor_id: contributorId,
        });
    }

    // ---- Event Contributors ------------------------------------------------

    /** POST /API/getEventContributor */
    async getEventContributor(eventContributorId) {
        return this._postJson(this.URLs.getEventContributor, {
            event_contributor_id: eventContributorId,
        });
    }

    /** POST /API/createEventContributor */
    async createEventContributor(data) {
        return this._postJson(this.URLs.createEventContributor, data);
    }

    /** POST /API/updateEventContributor */
    async updateEventContributor(data) {
        return this._postJson(this.URLs.updateEventContributor, data);
    }

    /** POST /API/deleteEventContributor */
    async deleteEventContributor(eventContributorId) {
        return this._postJson(this.URLs.deleteEventContributor, {
            event_contributor_id: eventContributorId,
        });
    }

    /**
     * POST /API/associateEventContributors — household / corporate grouping.
     */
    async associateEventContributors(data) {
        return this._postJson(this.URLs.associateEventContributors, data);
    }

    // ---- Activity & Transactions -------------------------------------------

    /** POST /API/getActivity — activity for one event contributor. */
    async getActivity(eventContributorId) {
        return this._postJson(this.URLs.getActivity, {
            event_contributor_id: eventContributorId,
        });
    }

    /** POST /API/getSales — sales for an event (post-event sync). */
    async getSales(eventId) {
        return this._postJson(this.URLs.getSales, { event_id: eventId });
    }

    /**
     * POST /API/getPayments — payments for an event.
     * Optional `paymentTypes` becomes `payment_type` (array) in the body.
     */
    async getPayments(eventId, paymentTypes) {
        const body = { event_id: eventId };
        if (paymentTypes) {
            body.payment_type = Array.isArray(paymentTypes)
                ? paymentTypes
                : [paymentTypes];
        }
        return this._postJson(this.URLs.getPayments, body);
    }

    // ---- Packages & Categories ---------------------------------------------

    /** POST /API/getPackages — packages for an event. */
    async getPackages(eventId) {
        return this._postJson(this.URLs.getPackages, { event_id: eventId });
    }

    /** POST /API/getPackageCategories — package categories for an event. */
    async getPackageCategories(eventId) {
        return this._postJson(this.URLs.getPackageCategories, {
            event_id: eventId,
        });
    }

    // ---- Post-Event --------------------------------------------------------

    /**
     * POST /API/lockEvent — lock (default) or unlock an event for final sync.
     */
    async lockEvent(eventId, lock = true) {
        return this._postJson(this.URLs.lockEvent, {
            event_id: eventId,
            lock,
        });
    }
}

module.exports = { Api };
