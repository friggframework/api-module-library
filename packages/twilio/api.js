const { ApiKeyRequester, get } = require('@friggframework/core');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        
        this.account_sid = get(params, 'account_sid', null);
        this.api_key = get(params, 'api_key', null);
        this.api_secret = get(params, 'api_secret', null);
        
        this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.account_sid}`;
        
        this.URLs = {
            // Account
            account: '',
            
            // Messages
            messages: '/Messages.json',
            messageById: (sid) => `/Messages/${sid}.json`,
            
            // Calls
            calls: '/Calls.json',
            callById: (sid) => `/Calls/${sid}.json`,
            
            // Phone Numbers
            incomingPhoneNumbers: '/IncomingPhoneNumbers.json',
            incomingPhoneNumberById: (sid) => `/IncomingPhoneNumbers/${sid}.json`,
            availablePhoneNumbers: (countryCode) => `/AvailablePhoneNumbers/${countryCode}/Local.json`,
            
            // Applications
            applications: '/Applications.json',
            applicationById: (sid) => `/Applications/${sid}.json`,
            
            // Conferences
            conferences: '/Conferences.json',
            conferenceById: (sid) => `/Conferences/${sid}.json`,
            conferenceParticipants: (conferenceSid) => `/Conferences/${conferenceSid}/Participants.json`,
            conferenceParticipantById: (conferenceSid, participantSid) => `/Conferences/${conferenceSid}/Participants/${participantSid}.json`,
            
            // Queues
            queues: '/Queues.json',
            queueById: (sid) => `/Queues/${sid}.json`,
            queueMembers: (queueSid) => `/Queues/${queueSid}/Members.json`,
            
            // Recordings
            recordings: '/Recordings.json',
            recordingById: (sid) => `/Recordings/${sid}.json`,
            
            // Usage
            usage: '/Usage/Records.json',
            usageToday: '/Usage/Records/Today.json',
            usageYesterday: '/Usage/Records/Yesterday.json',
            usageThisMonth: '/Usage/Records/ThisMonth.json',
            usageLastMonth: '/Usage/Records/LastMonth.json',
        };
    }

    addAuthHeaders(headers = {}) {
        const credentials = Buffer.from(`${this.api_key}:${this.api_secret}`).toString('base64');
        headers.Authorization = `Basic ${credentials}`;
        return headers;
    }

    async _request(url, options = {}) {
        options.headers = this.addAuthHeaders(options.headers);
        return super._request(url, options);
    }

    // **************************   Account Methods   **********************************

    async getAccount() {
        const options = {
            url: this.baseUrl + this.URLs.account + '.json',
        };
        return this._get(options);
    }

    async updateAccount(params) {
        const options = {
            url: this.baseUrl + this.URLs.account + '.json',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        return this._post(options, false);
    }

    // **************************   Messages Methods   **********************************

    async getMessages(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.messages,
            query: params,
        };
        return this._get(options);
    }

    async getMessage(messageSid) {
        const options = {
            url: this.baseUrl + this.URLs.messageById(messageSid),
        };
        return this._get(options);
    }

    async sendMessage(to, from, body, params = {}) {
        const messageData = {
            To: to,
            From: from,
            Body: body,
            ...params,
        };

        const options = {
            url: this.baseUrl + this.URLs.messages,
            body: new URLSearchParams(messageData).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        return this._post(options, false);
    }

    async deleteMessage(messageSid) {
        const options = {
            url: this.baseUrl + this.URLs.messageById(messageSid),
        };
        return this._delete(options);
    }

    // **************************   Calls Methods   **********************************

    async getCalls(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.calls,
            query: params,
        };
        return this._get(options);
    }

    async getCall(callSid) {
        const options = {
            url: this.baseUrl + this.URLs.callById(callSid),
        };
        return this._get(options);
    }

    async makeCall(to, from, url, params = {}) {
        const callData = {
            To: to,
            From: from,
            Url: url,
            ...params,
        };

        const options = {
            url: this.baseUrl + this.URLs.calls,
            body: new URLSearchParams(callData).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        return this._post(options, false);
    }

    async updateCall(callSid, params) {
        const options = {
            url: this.baseUrl + this.URLs.callById(callSid),
            body: new URLSearchParams(params).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        return this._post(options, false);
    }

    async deleteCall(callSid) {
        const options = {
            url: this.baseUrl + this.URLs.callById(callSid),
        };
        return this._delete(options);
    }

    // **************************   Phone Numbers Methods   **********************************

    async getIncomingPhoneNumbers(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.incomingPhoneNumbers,
            query: params,
        };
        return this._get(options);
    }

    async getIncomingPhoneNumber(phoneNumberSid) {
        const options = {
            url: this.baseUrl + this.URLs.incomingPhoneNumberById(phoneNumberSid),
        };
        return this._get(options);
    }

    async purchasePhoneNumber(phoneNumber, params = {}) {
        const phoneData = {
            PhoneNumber: phoneNumber,
            ...params,
        };

        const options = {
            url: this.baseUrl + this.URLs.incomingPhoneNumbers,
            body: new URLSearchParams(phoneData).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        return this._post(options, false);
    }

    async updateIncomingPhoneNumber(phoneNumberSid, params) {
        const options = {
            url: this.baseUrl + this.URLs.incomingPhoneNumberById(phoneNumberSid),
            body: new URLSearchParams(params).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        return this._post(options, false);
    }

    async deleteIncomingPhoneNumber(phoneNumberSid) {
        const options = {
            url: this.baseUrl + this.URLs.incomingPhoneNumberById(phoneNumberSid),
        };
        return this._delete(options);
    }

    async getAvailablePhoneNumbers(countryCode, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.availablePhoneNumbers(countryCode),
            query: params,
        };
        return this._get(options);
    }

    // **************************   Applications Methods   **********************************

    async getApplications(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.applications,
            query: params,
        };
        return this._get(options);
    }

    async getApplication(applicationSid) {
        const options = {
            url: this.baseUrl + this.URLs.applicationById(applicationSid),
        };
        return this._get(options);
    }

    async createApplication(friendlyName, params = {}) {
        const appData = {
            FriendlyName: friendlyName,
            ...params,
        };

        const options = {
            url: this.baseUrl + this.URLs.applications,
            body: new URLSearchParams(appData).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        return this._post(options, false);
    }

    async updateApplication(applicationSid, params) {
        const options = {
            url: this.baseUrl + this.URLs.applicationById(applicationSid),
            body: new URLSearchParams(params).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        return this._post(options, false);
    }

    async deleteApplication(applicationSid) {
        const options = {
            url: this.baseUrl + this.URLs.applicationById(applicationSid),
        };
        return this._delete(options);
    }

    // **************************   Conferences Methods   **********************************

    async getConferences(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.conferences,
            query: params,
        };
        return this._get(options);
    }

    async getConference(conferenceSid) {
        const options = {
            url: this.baseUrl + this.URLs.conferenceById(conferenceSid),
        };
        return this._get(options);
    }

    async getConferenceParticipants(conferenceSid) {
        const options = {
            url: this.baseUrl + this.URLs.conferenceParticipants(conferenceSid),
        };
        return this._get(options);
    }

    async getConferenceParticipant(conferenceSid, participantSid) {
        const options = {
            url: this.baseUrl + this.URLs.conferenceParticipantById(conferenceSid, participantSid),
        };
        return this._get(options);
    }

    async updateConferenceParticipant(conferenceSid, participantSid, params) {
        const options = {
            url: this.baseUrl + this.URLs.conferenceParticipantById(conferenceSid, participantSid),
            body: new URLSearchParams(params).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        return this._post(options, false);
    }

    async deleteConferenceParticipant(conferenceSid, participantSid) {
        const options = {
            url: this.baseUrl + this.URLs.conferenceParticipantById(conferenceSid, participantSid),
        };
        return this._delete(options);
    }

    // **************************   Recordings Methods   **********************************

    async getRecordings(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.recordings,
            query: params,
        };
        return this._get(options);
    }

    async getRecording(recordingSid) {
        const options = {
            url: this.baseUrl + this.URLs.recordingById(recordingSid),
        };
        return this._get(options);
    }

    async deleteRecording(recordingSid) {
        const options = {
            url: this.baseUrl + this.URLs.recordingById(recordingSid),
        };
        return this._delete(options);
    }

    // **************************   Usage Methods   **********************************

    async getUsageRecords(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.usage,
            query: params,
        };
        return this._get(options);
    }

    async getUsageToday() {
        const options = {
            url: this.baseUrl + this.URLs.usageToday,
        };
        return this._get(options);
    }

    async getUsageYesterday() {
        const options = {
            url: this.baseUrl + this.URLs.usageYesterday,
        };
        return this._get(options);
    }

    async getUsageThisMonth() {
        const options = {
            url: this.baseUrl + this.URLs.usageThisMonth,
        };
        return this._get(options);
    }

    async getUsageLastMonth() {
        const options = {
            url: this.baseUrl + this.URLs.usageLastMonth,
        };
        return this._get(options);
    }
}

module.exports = { Api };