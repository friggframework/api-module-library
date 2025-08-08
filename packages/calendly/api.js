const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = 'https://api.calendly.com';
        
        this.URLs = {
            authorization: '/oauth/authorize',
            access_token: '/oauth/token',
            
            // Users
            currentUser: '/users/me',
            userById: (userUri) => `/users/${encodeURIComponent(userUri)}`,
            
            // Organizations
            organizationMemberships: '/organization_memberships',
            organizations: '/organizations',
            organizationById: (organizationUri) => `/organizations/${encodeURIComponent(organizationUri)}`,
            
            // Event Types
            eventTypes: '/event_types',
            eventTypeById: (eventTypeUri) => `/event_types/${encodeURIComponent(eventTypeUri)}`,
            userEventTypes: (userUri) => `/event_types?user=${encodeURIComponent(userUri)}`,
            
            // Scheduled Events
            scheduledEvents: '/scheduled_events',
            scheduledEventById: (eventUri) => `/scheduled_events/${encodeURIComponent(eventUri)}`,
            scheduledEventInvitees: (eventUri) => `/scheduled_events/${encodeURIComponent(eventUri)}/invitees`,
            
            // Invitees
            invitees: '/scheduled_events/invitees',
            inviteeById: (inviteeUri) => `/scheduled_events/invitees/${encodeURIComponent(inviteeUri)}`,
            
            // Webhooks
            webhooks: '/webhook_subscriptions',
            webhookById: (webhookUri) => `/webhook_subscriptions/${encodeURIComponent(webhookUri)}`,
            
            // Availability
            userAvailabilitySchedules: (userUri) => `/user_availability_schedules?user=${encodeURIComponent(userUri)}`,
            availabilityScheduleById: (scheduleUri) => `/user_availability_schedules/${encodeURIComponent(scheduleUri)}`,
            
            // Routing Forms
            routingForms: '/routing_forms',
            routingFormById: (formUri) => `/routing_forms/${encodeURIComponent(formUri)}`,
            routingFormSubmissions: (formUri) => `/routing_form_submissions?form=${encodeURIComponent(formUri)}`,
        };

        this.authorizationUri = encodeURI(
            `https://auth.calendly.com/oauth/authorize?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&scope=${this.scope}&state=${this.state}`
        );
        this.tokenUri = 'https://auth.calendly.com/oauth/token';

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

    // **************************   Users Methods   **********************************

    async getCurrentUser() {
        const options = {
            url: this.baseUrl + this.URLs.currentUser,
        };
        return this._get(options);
    }

    async getUser(userUri) {
        const options = {
            url: this.baseUrl + this.URLs.userById(userUri),
        };
        return this._get(options);
    }

    // **************************   Organizations Methods   **********************************

    async getOrganizationMemberships(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.organizationMemberships,
            query: params,
        };
        return this._get(options);
    }

    async getOrganization(organizationUri) {
        const options = {
            url: this.baseUrl + this.URLs.organizationById(organizationUri),
        };
        return this._get(options);
    }

    // **************************   Event Types Methods   **********************************

    async getEventTypes(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.eventTypes,
            query: params,
        };
        return this._get(options);
    }

    async getUserEventTypes(userUri, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.userEventTypes(userUri),
            query: params,
        };
        return this._get(options);
    }

    async getEventType(eventTypeUri) {
        const options = {
            url: this.baseUrl + this.URLs.eventTypeById(eventTypeUri),
        };
        return this._get(options);
    }

    // **************************   Scheduled Events Methods   **********************************

    async getScheduledEvents(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.scheduledEvents,
            query: params,
        };
        return this._get(options);
    }

    async getScheduledEvent(eventUri) {
        const options = {
            url: this.baseUrl + this.URLs.scheduledEventById(eventUri),
        };
        return this._get(options);
    }

    async getScheduledEventInvitees(eventUri, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.scheduledEventInvitees(eventUri),
            query: params,
        };
        return this._get(options);
    }

    async cancelScheduledEvent(eventUri, reason = '') {
        const options = {
            url: this.baseUrl + this.URLs.scheduledEventById(eventUri) + '/cancellation',
            body: { reason },
        };
        return this._post(options);
    }

    // **************************   Invitees Methods   **********************************

    async getInvitee(inviteeUri) {
        const options = {
            url: this.baseUrl + this.URLs.inviteeById(inviteeUri),
        };
        return this._get(options);
    }

    async createInviteeNoShow(inviteeUri) {
        const options = {
            url: this.baseUrl + this.URLs.inviteeById(inviteeUri) + '/no_show',
            body: {},
        };
        return this._post(options);
    }

    async deleteInviteeNoShow(inviteeUri) {
        const options = {
            url: this.baseUrl + this.URLs.inviteeById(inviteeUri) + '/no_show',
        };
        return this._delete(options);
    }

    // **************************   Webhooks Methods   **********************************

    async getWebhooks(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.webhooks,
            query: params,
        };
        return this._get(options);
    }

    async createWebhook(webhookData) {
        const options = {
            url: this.baseUrl + this.URLs.webhooks,
            body: webhookData,
        };
        return this._post(options);
    }

    async getWebhook(webhookUri) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(webhookUri),
        };
        return this._get(options);
    }

    async deleteWebhook(webhookUri) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(webhookUri),
        };
        return this._delete(options);
    }

    // **************************   Availability Methods   **********************************

    async getUserAvailabilitySchedules(userUri, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.userAvailabilitySchedules(userUri),
            query: params,
        };
        return this._get(options);
    }

    async getAvailabilitySchedule(scheduleUri) {
        const options = {
            url: this.baseUrl + this.URLs.availabilityScheduleById(scheduleUri),
        };
        return this._get(options);
    }

    // **************************   Routing Forms Methods   **********************************

    async getRoutingForms(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.routingForms,
            query: params,
        };
        return this._get(options);
    }

    async getRoutingForm(formUri) {
        const options = {
            url: this.baseUrl + this.URLs.routingFormById(formUri),
        };
        return this._get(options);
    }

    async getRoutingFormSubmissions(formUri, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.routingFormSubmissions(formUri),
            query: params,
        };
        return this._get(options);
    }

    // **************************   Helper Methods   **********************************

    async getUserScheduledEvents(userUri, params = {}) {
        const eventParams = {
            user: userUri,
            ...params,
        };
        return this.getScheduledEvents(eventParams);
    }

    async getOrganizationScheduledEvents(organizationUri, params = {}) {
        const eventParams = {
            organization: organizationUri,
            ...params,
        };
        return this.getScheduledEvents(eventParams);
    }

    async getUserUpcomingEvents(userUri, maxStartTime) {
        const now = new Date().toISOString();
        const params = {
            user: userUri,
            min_start_time: now,
            max_start_time: maxStartTime || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            sort: 'start_time:asc',
        };
        return this.getScheduledEvents(params);
    }

    extractUriFromUrl(url) {
        // Calendly API often returns full URLs, but we need just the URI part
        if (url.includes('api.calendly.com')) {
            return url.split('api.calendly.com')[1];
        }
        return url;
    }
}

module.exports = { Api };