const { OAuth2Requester, get } = require('@friggframework/core');
const FormData = require('form-data');
const fs = require('fs');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.access_token = get(params, 'access_token', null);
        this.phone_number_id = get(params, 'phone_number_id', null);
        this.whatsapp_business_account_id = get(params, 'whatsapp_business_account_id', null);
        this.api_version = get(params, 'api_version', 'v18.0');
        
        this.baseUrl = `https://graph.facebook.com/${this.api_version}`;
        
        this.URLs = {
            // Messages
            messages: `/${this.phone_number_id}/messages`,
            
            // Media
            media: `/${this.phone_number_id}/media`,
            mediaById: (mediaId) => `/${mediaId}`,
            
            // Phone Numbers
            phoneNumbers: `/${this.whatsapp_business_account_id}/phone_numbers`,
            phoneNumberById: (phoneNumberId) => `/${phoneNumberId}`,
            
            // Message Templates
            messageTemplates: `/${this.whatsapp_business_account_id}/message_templates`,
            messageTemplateById: (templateId) => `/${templateId}`,
            
            // Webhooks
            webhooks: `/${this.whatsapp_business_account_id}/subscribed_apps`,
            
            // Business Profile
            businessProfile: `/${this.phone_number_id}/whatsapp_business_profile`,
            
            // Account
            account: `/${this.whatsapp_business_account_id}`,
        };
    }

    addAuthHeaders(headers = {}) {
        if (this.access_token) {
            headers.Authorization = `Bearer ${this.access_token}`;
        }
        return headers;
    }

    async _request(url, options = {}) {
        options.headers = this.addAuthHeaders(options.headers);
        return super._request(url, options);
    }

    // **************************   Message Methods   **********************************

    async sendMessage(to, message, params = {}) {
        const messageData = {
            messaging_product: 'whatsapp',
            to,
            ...message,
            ...params
        };

        const options = {
            url: this.baseUrl + this.URLs.messages,
            body: messageData
        };
        return this._post(options);
    }

    async sendTextMessage(to, text, params = {}) {
        const message = {
            type: 'text',
            text: { body: text }
        };
        return this.sendMessage(to, message, params);
    }

    async sendImageMessage(to, imageId, caption = '', params = {}) {
        const message = {
            type: 'image',
            image: {
                id: imageId,
                caption
            }
        };
        return this.sendMessage(to, message, params);
    }

    async sendDocumentMessage(to, documentId, filename = '', caption = '', params = {}) {
        const message = {
            type: 'document',
            document: {
                id: documentId,
                filename,
                caption
            }
        };
        return this.sendMessage(to, message, params);
    }

    async sendAudioMessage(to, audioId, params = {}) {
        const message = {
            type: 'audio',
            audio: { id: audioId }
        };
        return this.sendMessage(to, message, params);
    }

    async sendVideoMessage(to, videoId, caption = '', params = {}) {
        const message = {
            type: 'video',
            video: {
                id: videoId,
                caption
            }
        };
        return this.sendMessage(to, message, params);
    }

    async sendLocationMessage(to, latitude, longitude, name = '', address = '', params = {}) {
        const message = {
            type: 'location',
            location: {
                latitude,
                longitude,
                name,
                address
            }
        };
        return this.sendMessage(to, message, params);
    }

    async sendContactMessage(to, contact, params = {}) {
        const message = {
            type: 'contacts',
            contacts: [contact]
        };
        return this.sendMessage(to, message, params);
    }

    async sendTemplateMessage(to, templateName, languageCode, components = [], params = {}) {
        const message = {
            type: 'template',
            template: {
                name: templateName,
                language: { code: languageCode },
                components
            }
        };
        return this.sendMessage(to, message, params);
    }

    async sendInteractiveMessage(to, interactive, params = {}) {
        const message = {
            type: 'interactive',
            interactive
        };
        return this.sendMessage(to, message, params);
    }

    async sendButtonMessage(to, bodyText, buttons, params = {}) {
        const interactive = {
            type: 'button',
            body: { text: bodyText },
            action: { buttons }
        };
        return this.sendInteractiveMessage(to, interactive, params);
    }

    async sendListMessage(to, bodyText, buttonText, sections, params = {}) {
        const interactive = {
            type: 'list',
            body: { text: bodyText },
            action: {
                button: buttonText,
                sections
            }
        };
        return this.sendInteractiveMessage(to, interactive, params);
    }

    // **************************   Media Methods   **********************************

    async uploadMedia(file, type, params = {}) {
        const form = new FormData();
        form.append('file', fs.createReadStream(file));
        form.append('type', type);
        form.append('messaging_product', 'whatsapp');
        
        Object.keys(params).forEach(key => {
            form.append(key, params[key]);
        });

        const options = {
            url: this.baseUrl + this.URLs.media,
            body: form,
            headers: {
                ...form.getHeaders(),
                ...this.addAuthHeaders()
            }
        };
        return this._post(options, false);
    }

    async getMedia(mediaId) {
        const options = {
            url: this.baseUrl + this.URLs.mediaById(mediaId),
        };
        return this._get(options);
    }

    async deleteMedia(mediaId) {
        const options = {
            url: this.baseUrl + this.URLs.mediaById(mediaId),
        };
        return this._delete(options);
    }

    async downloadMedia(mediaUrl) {
        const options = {
            url: mediaUrl,
            headers: this.addAuthHeaders()
        };
        return this._get(options);
    }

    // **************************   Template Methods   **********************************

    async getMessageTemplates(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.messageTemplates,
            query: params
        };
        return this._get(options);
    }

    async createMessageTemplate(name, category, language, components, params = {}) {
        const templateData = {
            name,
            category,
            language,
            components,
            ...params
        };

        const options = {
            url: this.baseUrl + this.URLs.messageTemplates,
            body: templateData
        };
        return this._post(options);
    }

    async getMessageTemplate(templateId) {
        const options = {
            url: this.baseUrl + this.URLs.messageTemplateById(templateId),
        };
        return this._get(options);
    }

    async deleteMessageTemplate(templateId) {
        const options = {
            url: this.baseUrl + this.URLs.messageTemplateById(templateId),
        };
        return this._delete(options);
    }

    // **************************   Phone Number Methods   **********************************

    async getPhoneNumbers(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.phoneNumbers,
            query: params
        };
        return this._get(options);
    }

    async getPhoneNumber(phoneNumberId) {
        const options = {
            url: this.baseUrl + this.URLs.phoneNumberById(phoneNumberId),
        };
        return this._get(options);
    }

    async updatePhoneNumber(phoneNumberId, params) {
        const options = {
            url: this.baseUrl + this.URLs.phoneNumberById(phoneNumberId),
            body: params
        };
        return this._post(options);
    }

    // **************************   Business Profile Methods   **********************************

    async getBusinessProfile(fields = []) {
        const options = {
            url: this.baseUrl + this.URLs.businessProfile,
            query: fields.length > 0 ? { fields: fields.join(',') } : {}
        };
        return this._get(options);
    }

    async updateBusinessProfile(profileData) {
        const options = {
            url: this.baseUrl + this.URLs.businessProfile,
            body: profileData
        };
        return this._post(options);
    }

    // **************************   Account Methods   **********************************

    async getAccountInfo(fields = []) {
        const options = {
            url: this.baseUrl + this.URLs.account,
            query: fields.length > 0 ? { fields: fields.join(',') } : {}
        };
        return this._get(options);
    }

    // **************************   Webhook Methods   **********************************

    async subscribeToWebhooks(callbackUrl, verifyToken, fields = []) {
        const subscriptionData = {
            object: 'whatsapp_business_account',
            callback_url: callbackUrl,
            verify_token: verifyToken,
            fields: fields.join(',')
        };

        const options = {
            url: this.baseUrl + this.URLs.webhooks,
            body: subscriptionData
        };
        return this._post(options);
    }

    async getWebhookSubscriptions() {
        const options = {
            url: this.baseUrl + this.URLs.webhooks,
        };
        return this._get(options);
    }

    async unsubscribeFromWebhooks() {
        const options = {
            url: this.baseUrl + this.URLs.webhooks,
        };
        return this._delete(options);
    }

    // **************************   Webhook Handling   **********************************

    async handleWebhook(body) {
        // Process incoming webhook data
        const entry = body.entry?.[0];
        if (!entry) return null;

        const changes = entry.changes?.[0];
        if (!changes) return null;

        const value = changes.value;
        if (!value) return null;

        if (value.messages && value.messages.length > 0) {
            return {
                type: 'message',
                data: {
                    messages: value.messages,
                    contacts: value.contacts,
                    metadata: value.metadata
                }
            };
        }

        if (value.statuses && value.statuses.length > 0) {
            return {
                type: 'status',
                data: {
                    statuses: value.statuses,
                    metadata: value.metadata
                }
            };
        }

        return {
            type: 'unknown',
            data: value
        };
    }

    async verifyWebhook(mode, token, challenge, verifyToken) {
        if (mode === 'subscribe' && token === verifyToken) {
            return challenge;
        }
        throw new Error('Webhook verification failed');
    }

    // **************************   Message Status Methods   **********************************

    async markMessageAsRead(messageId) {
        const options = {
            url: this.baseUrl + this.URLs.messages,
            body: {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId
            }
        };
        return this._post(options);
    }

    // **************************   Error Handling   **********************************

    async handleError(error) {
        if (error.response && error.response.data) {
            const errorData = error.response.data.error;
            return {
                code: errorData.code,
                message: errorData.message,
                type: errorData.type,
                error_subcode: errorData.error_subcode,
                fbtrace_id: errorData.fbtrace_id
            };
        }
        return {
            message: error.message || 'Unknown error occurred'
        };
    }
}

module.exports = { Api };