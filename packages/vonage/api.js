const { ApiKeyRequester, get } = require('@friggframework/core');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        
        this.api_key = get(params, 'api_key', null);
        this.api_secret = get(params, 'api_secret', null);
        this.application_id = get(params, 'application_id', null);
        this.private_key = get(params, 'private_key', null);
        this.signature_secret = get(params, 'signature_secret', null);
        
        this.baseUrl = 'https://api.nexmo.com';
        this.baseUrlV2 = 'https://api.nexmo.com/v2';
        this.restBaseUrl = 'https://rest.nexmo.com';
        
        this.URLs = {
            // SMS
            sms: '/sms/json',
            
            // Voice
            voice: '/v1/calls',
            voiceById: (id) => `/v1/calls/${id}`,
            voiceActions: (id) => `/v1/calls/${id}/actions`,
            
            // Verify
            verify: '/verify/json',
            verifyCheck: '/verify/check/json',
            verifyControl: '/verify/control/json',
            verifySearch: '/verify/search/json',
            
            // Number Insight
            numberInsight: '/number/insight/json',
            numberInsightBasic: '/ni/basic/json',
            numberInsightStandard: '/ni/standard/json',
            numberInsightAdvanced: '/ni/advanced/json',
            
            // Numbers
            numbers: '/number/search/json',
            numbersOwn: '/account/numbers/json',
            numbersBuy: '/number/buy/json',
            numbersCancel: '/number/cancel/json',
            numbersUpdate: '/number/update/json',
            
            // Account
            account: '/account/get-balance/json',
            accountPricing: '/account/get-pricing/outbound/json',
            accountSmsOutbound: '/account/get-pricing/outbound/sms/json',
            accountVoiceOutbound: '/account/get-pricing/outbound/voice/json',
            accountSettings: '/account/settings/json',
            accountTopUp: '/account/top-up/json',
            
            // Messages v2
            messages: '/messages',
            
            // Conversations
            conversations: '/conversations',
            conversationById: (id) => `/conversations/${id}`,
            conversationEvents: (id) => `/conversations/${id}/events`,
            conversationMembers: (id) => `/conversations/${id}/members`,
            conversationMemberById: (id, memberId) => `/conversations/${id}/members/${memberId}`,
            
            // Users
            users: '/users',
            userById: (id) => `/users/${id}`,
            
            // Applications
            applications: '/applications',
            applicationById: (id) => `/applications/${id}`,
            
            // Webhooks
            webhooks: '/webhooks',
        };
    }

    // Generate JWT for application authentication
    generateJWT() {
        if (!this.application_id || !this.private_key) {
            throw new Error('Application ID and private key are required for JWT generation');
        }
        
        const payload = {
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
            application_id: this.application_id
        };
        
        return jwt.sign(payload, this.private_key, { algorithm: 'RS256' });
    }

    addAuthHeaders(headers = {}) {
        // For JWT authentication (Voice, Messages, Conversations)
        if (this.application_id && this.private_key) {
            headers.Authorization = `Bearer ${this.generateJWT()}`;
        }
        return headers;
    }

    addKeySecretAuth(params = {}) {
        // For API key/secret authentication (SMS, Verify, Numbers)
        if (this.api_key && this.api_secret) {
            params.api_key = this.api_key;
            params.api_secret = this.api_secret;
        }
        return params;
    }

    async _request(url, options = {}) {
        if (url.includes('/v1/calls') || url.includes('/messages') || url.includes('/conversations') || url.includes('/users')) {
            // Use JWT auth for Voice, Messages, Conversations APIs
            options.headers = this.addAuthHeaders(options.headers);
        } else {
            // Use API key/secret for SMS, Verify, Numbers APIs
            if (options.body && typeof options.body === 'object') {
                options.body = this.addKeySecretAuth(options.body);
            }
            if (options.query && typeof options.query === 'object') {
                options.query = this.addKeySecretAuth(options.query);
            }
        }
        
        return super._request(url, options);
    }

    // **************************   SMS Methods   **********************************

    async sendSMS(from, to, text, params = {}) {
        const smsData = {
            from,
            to,
            text,
            ...params
        };

        const options = {
            url: this.restBaseUrl + this.URLs.sms,
            body: smsData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        
        // Convert body to URL-encoded format
        const urlEncodedBody = new URLSearchParams(this.addKeySecretAuth(smsData)).toString();
        options.body = urlEncodedBody;
        
        return this._post(options, false);
    }

    async sendUnicodeSMS(from, to, text, params = {}) {
        return this.sendSMS(from, to, text, { ...params, type: 'unicode' });
    }

    async sendBinarySMS(from, to, body, udh, params = {}) {
        return this.sendSMS(from, to, '', { ...params, type: 'binary', body, udh });
    }

    // **************************   Voice Methods   **********************************

    async makeCall(from, to, answer_url, params = {}) {
        const callData = {
            from: { type: 'phone', number: from },
            to: [{ type: 'phone', number: to }],
            answer_url: [answer_url],
            ...params
        };

        const options = {
            url: this.baseUrl + this.URLs.voice,
            body: callData
        };
        return this._post(options);
    }

    async getCalls(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.voice,
            query: params
        };
        return this._get(options);
    }

    async getCall(callId) {
        const options = {
            url: this.baseUrl + this.URLs.voiceById(callId),
        };
        return this._get(options);
    }

    async updateCall(callId, action) {
        const options = {
            url: this.baseUrl + this.URLs.voiceActions(callId),
            body: { action }
        };
        return this._put(options);
    }

    async hangupCall(callId) {
        return this.updateCall(callId, 'hangup');
    }

    async muteCall(callId) {
        return this.updateCall(callId, 'mute');
    }

    async unmuteCall(callId) {
        return this.updateCall(callId, 'unmute');
    }

    async earmuffCall(callId) {
        return this.updateCall(callId, 'earmuff');
    }

    async unearmuffCall(callId) {
        return this.updateCall(callId, 'unearmuff');
    }

    async transferCall(callId, destination) {
        return this.updateCall(callId, {
            action: 'transfer',
            destination
        });
    }

    // **************************   Verify Methods   **********************************

    async sendVerification(number, brand, params = {}) {
        const verifyData = {
            number,
            brand,
            ...params
        };

        const options = {
            url: this.baseUrl + this.URLs.verify,
            body: verifyData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        
        const urlEncodedBody = new URLSearchParams(this.addKeySecretAuth(verifyData)).toString();
        options.body = urlEncodedBody;
        
        return this._post(options, false);
    }

    async checkVerification(request_id, code) {
        const checkData = {
            request_id,
            code
        };

        const options = {
            url: this.baseUrl + this.URLs.verifyCheck,
            body: checkData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        
        const urlEncodedBody = new URLSearchParams(this.addKeySecretAuth(checkData)).toString();
        options.body = urlEncodedBody;
        
        return this._post(options, false);
    }

    async cancelVerification(request_id) {
        const controlData = {
            request_id,
            cmd: 'cancel'
        };

        const options = {
            url: this.baseUrl + this.URLs.verifyControl,
            body: controlData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        
        const urlEncodedBody = new URLSearchParams(this.addKeySecretAuth(controlData)).toString();
        options.body = urlEncodedBody;
        
        return this._post(options, false);
    }

    async searchVerification(request_id) {
        const options = {
            url: this.baseUrl + this.URLs.verifySearch,
            query: this.addKeySecretAuth({ request_id })
        };
        return this._get(options);
    }

    // **************************   Number Insight Methods   **********************************

    async getNumberInsight(number, features = ['basic'], params = {}) {
        const insightData = {
            number,
            features: features.join(','),
            ...params
        };

        const options = {
            url: this.baseUrl + this.URLs.numberInsight,
            query: this.addKeySecretAuth(insightData)
        };
        return this._get(options);
    }

    async getBasicNumberInsight(number, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.numberInsightBasic,
            query: this.addKeySecretAuth({ number, ...params })
        };
        return this._get(options);
    }

    async getStandardNumberInsight(number, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.numberInsightStandard,
            query: this.addKeySecretAuth({ number, ...params })
        };
        return this._get(options);
    }

    async getAdvancedNumberInsight(number, callback = null, params = {}) {
        const insightData = { number, ...params };
        if (callback) insightData.callback = callback;

        const options = {
            url: this.baseUrl + this.URLs.numberInsightAdvanced,
            query: this.addKeySecretAuth(insightData)
        };
        return this._get(options);
    }

    // **************************   Number Management Methods   **********************************

    async searchNumbers(country, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.numbers,
            query: this.addKeySecretAuth({ country, ...params })
        };
        return this._get(options);
    }

    async getOwnNumbers(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.numbersOwn,
            query: this.addKeySecretAuth(params)
        };
        return this._get(options);
    }

    async buyNumber(country, msisdn, params = {}) {
        const numberData = {
            country,
            msisdn,
            ...params
        };

        const options = {
            url: this.baseUrl + this.URLs.numbersBuy,
            body: numberData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        
        const urlEncodedBody = new URLSearchParams(this.addKeySecretAuth(numberData)).toString();
        options.body = urlEncodedBody;
        
        return this._post(options, false);
    }

    async cancelNumber(country, msisdn, params = {}) {
        const numberData = {
            country,
            msisdn,
            ...params
        };

        const options = {
            url: this.baseUrl + this.URLs.numbersCancel,
            body: numberData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        
        const urlEncodedBody = new URLSearchParams(this.addKeySecretAuth(numberData)).toString();
        options.body = urlEncodedBody;
        
        return this._post(options, false);
    }

    async updateNumber(country, msisdn, params = {}) {
        const numberData = {
            country,
            msisdn,
            ...params
        };

        const options = {
            url: this.baseUrl + this.URLs.numbersUpdate,
            body: numberData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        
        const urlEncodedBody = new URLSearchParams(this.addKeySecretAuth(numberData)).toString();
        options.body = urlEncodedBody;
        
        return this._post(options, false);
    }

    // **************************   Account Methods   **********************************

    async getBalance() {
        const options = {
            url: this.baseUrl + this.URLs.account,
            query: this.addKeySecretAuth()
        };
        return this._get(options);
    }

    async getPricing(country, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.accountPricing,
            query: this.addKeySecretAuth({ country, ...params })
        };
        return this._get(options);
    }

    async getSMSPricing(country, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.accountSmsOutbound,
            query: this.addKeySecretAuth({ country, ...params })
        };
        return this._get(options);
    }

    async getVoicePricing(country, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.accountVoiceOutbound,
            query: this.addKeySecretAuth({ country, ...params })
        };
        return this._get(options);
    }

    async getAccountSettings() {
        const options = {
            url: this.baseUrl + this.URLs.accountSettings,
            query: this.addKeySecretAuth()
        };
        return this._get(options);
    }

    async updateAccountSettings(params) {
        const options = {
            url: this.baseUrl + this.URLs.accountSettings,
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        
        const urlEncodedBody = new URLSearchParams(this.addKeySecretAuth(params)).toString();
        options.body = urlEncodedBody;
        
        return this._post(options, false);
    }

    // **************************   Messages v2 Methods   **********************************

    async sendMessage(from, to, message, params = {}) {
        const messageData = {
            from,
            to,
            message,
            ...params
        };

        const options = {
            url: this.baseUrlV2 + this.URLs.messages,
            body: messageData
        };
        return this._post(options);
    }

    async sendTextMessage(from, to, text, params = {}) {
        const message = {
            content: {
                type: 'text',
                text
            }
        };
        return this.sendMessage(from, to, message, params);
    }

    async sendImageMessage(from, to, imageUrl, caption = '', params = {}) {
        const message = {
            content: {
                type: 'image',
                image: {
                    url: imageUrl,
                    caption
                }
            }
        };
        return this.sendMessage(from, to, message, params);
    }

    async sendFileMessage(from, to, fileUrl, caption = '', params = {}) {
        const message = {
            content: {
                type: 'file',
                file: {
                    url: fileUrl,
                    caption
                }
            }
        };
        return this.sendMessage(from, to, message, params);
    }

    async sendTemplateMessage(from, to, templateName, parameters = [], params = {}) {
        const message = {
            content: {
                type: 'template',
                template: {
                    name: templateName,
                    parameters
                }
            }
        };
        return this.sendMessage(from, to, message, params);
    }

    // **************************   Webhook Methods   **********************************

    async handleWebhook(body, signature = null) {
        // Validate webhook signature if provided
        if (signature && this.signature_secret) {
            const expectedSignature = crypto.createHmac('sha256', this.signature_secret)
                .update(JSON.stringify(body))
                .digest('hex');
            
            if (signature !== expectedSignature) {
                throw new Error('Invalid webhook signature');
            }
        }

        // Process different webhook types
        if (body.message_uuid) {
            // Voice webhook
            return {
                type: 'voice',
                data: body
            };
        } else if (body.messageId || body.message_uuid) {
            // SMS delivery receipt
            return {
                type: 'sms_delivery',
                data: body
            };
        } else if (body.request_id) {
            // Verify webhook
            return {
                type: 'verify',
                data: body
            };
        } else if (body.from && body.to) {
            // Inbound message
            return {
                type: 'inbound_message',
                data: body
            };
        }

        return {
            type: 'unknown',
            data: body
        };
    }

    async verifyWebhookSignature(body, signature) {
        if (!this.signature_secret) {
            throw new Error('Signature secret not configured');
        }
        
        const expectedSignature = crypto.createHmac('sha256', this.signature_secret)
            .update(typeof body === 'string' ? body : JSON.stringify(body))
            .digest('hex');
        
        return signature === expectedSignature;
    }

    // **************************   Error Handling   **********************************

    async handleError(error) {
        if (error.response && error.response.data) {
            const errorData = error.response.data;
            return {
                message: errorData.error_text || errorData.error || 'Unknown error',
                status: errorData.status,
                error_code: errorData.error_code
            };
        }
        return {
            message: error.message || 'Unknown error occurred'
        };
    }
}

module.exports = { Api };