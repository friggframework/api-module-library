const { OAuth2Requester } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://www.eventbriteapi.com/v3';

        this.URLs = {
            // User
            user: '/users/me',
            
            // Events
            events: '/events',
            eventById: (eventId) => `/events/${eventId}`,
            myEvents: '/users/me/events',
            
            // Orders
            orders: '/events/{event_id}/orders',
            orderById: (orderId) => `/orders/${orderId}`,
            
            // Attendees
            attendees: '/events/{event_id}/attendees',
            attendeeById: (attendeeId) => `/attendees/${attendeeId}`,
            
            // Tickets
            ticketClasses: '/events/{event_id}/ticket_classes',
            ticketClassById: (ticketClassId) => `/ticket_classes/${ticketClassId}`,
            
            // Venues
            venues: '/venues',
            venueById: (venueId) => `/venues/${venueId}`,
            
            // Organizations
            organizations: '/users/me/organizations',
            organizationById: (organizationId) => `/organizations/${organizationId}`,
            
            // Webhooks
            webhooks: '/webhooks',
            webhookById: (webhookId) => `/webhooks/${webhookId}`,
        };

        this.authorizationUri = encodeURI(
            `https://www.eventbrite.com/oauth/authorize?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}`
        );
        this.tokenUri = 'https://www.eventbrite.com/oauth/token';
    }

    async getTokenFromCode(code) {
        const options = {
            url: this.tokenUri,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            form: {
                grant_type: 'authorization_code',
                client_id: this.client_id,
                client_secret: this.client_secret,
                redirect_uri: this.redirect_uri,
                code: code,
            },
        };
        const response = await this._request(options);
        await this.setTokens(response);
        return response;
    }

    // User
    async getUser() {
        const options = {
            url: this.baseUrl + this.URLs.user,
            method: 'GET',
        };
        return this._request(options);
    }

    // Events
    async listEvents(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.events,
            method: 'GET',
            qs: params,
        };
        return this._request(options);
    }

    async getMyEvents(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.myEvents,
            method: 'GET',
            qs: params,
        };
        return this._request(options);
    }

    async getEvent(eventId) {
        const options = {
            url: this.baseUrl + this.URLs.eventById(eventId),
            method: 'GET',
        };
        return this._request(options);
    }

    async createEvent(eventData) {
        const options = {
            url: this.baseUrl + this.URLs.events,
            method: 'POST',
            json: eventData,
        };
        return this._request(options);
    }

    async updateEvent(eventId, eventData) {
        const options = {
            url: this.baseUrl + this.URLs.eventById(eventId),
            method: 'POST',
            json: eventData,
        };
        return this._request(options);
    }

    // Orders
    async getEventOrders(eventId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.orders.replace('{event_id}', eventId),
            method: 'GET',
            qs: params,
        };
        return this._request(options);
    }

    async getOrder(orderId) {
        const options = {
            url: this.baseUrl + this.URLs.orderById(orderId),
            method: 'GET',
        };
        return this._request(options);
    }

    // Attendees
    async getEventAttendees(eventId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.attendees.replace('{event_id}', eventId),
            method: 'GET',
            qs: params,
        };
        return this._request(options);
    }

    // Organizations
    async getOrganizations() {
        const options = {
            url: this.baseUrl + this.URLs.organizations,
            method: 'GET',
        };
        return this._request(options);
    }

    // User info for authentication
    async getUserDetails() {
        return this.getUser();
    }
}

module.exports = { Api };