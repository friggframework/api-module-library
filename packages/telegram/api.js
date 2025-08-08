const { ApiKeyRequester, get } = require('@friggframework/core');
const FormData = require('form-data');
const fs = require('fs');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        
        this.bot_token = get(params, 'bot_token', null);
        this.baseUrl = `https://api.telegram.org/bot${this.bot_token}`;
        
        this.URLs = {
            // Bot info
            getMe: '/getMe',
            
            // Messages
            sendMessage: '/sendMessage',
            forwardMessage: '/forwardMessage',
            sendPhoto: '/sendPhoto',
            sendAudio: '/sendAudio',
            sendDocument: '/sendDocument',
            sendVideo: '/sendVideo',
            sendAnimation: '/sendAnimation',
            sendVoice: '/sendVoice',
            sendVideoNote: '/sendVideoNote',
            sendMediaGroup: '/sendMediaGroup',
            sendLocation: '/sendLocation',
            sendVenue: '/sendVenue',
            sendContact: '/sendContact',
            sendPoll: '/sendPoll',
            sendDice: '/sendDice',
            sendChatAction: '/sendChatAction',
            
            // Updates
            getUpdates: '/getUpdates',
            setWebhook: '/setWebhook',
            deleteWebhook: '/deleteWebhook',
            getWebhookInfo: '/getWebhookInfo',
            
            // Chat management
            getChat: '/getChat',
            getChatAdministrators: '/getChatAdministrators',
            getChatMemberCount: '/getChatMemberCount',
            getChatMember: '/getChatMember',
            setChatStickerSet: '/setChatStickerSet',
            deleteChatStickerSet: '/deleteChatStickerSet',
            
            // Message editing
            editMessageText: '/editMessageText',
            editMessageCaption: '/editMessageCaption',
            editMessageMedia: '/editMessageMedia',
            editMessageReplyMarkup: '/editMessageReplyMarkup',
            stopPoll: '/stopPoll',
            deleteMessage: '/deleteMessage',
            
            // Inline mode
            answerInlineQuery: '/answerInlineQuery',
            answerCallbackQuery: '/answerCallbackQuery',
            
            // Files
            getFile: '/getFile',
            
            // Commands
            setMyCommands: '/setMyCommands',
            deleteMyCommands: '/deleteMyCommands',
            getMyCommands: '/getMyCommands',
        };
    }

    async _request(url, options = {}) {
        // Telegram API doesn't use standard auth headers
        return super._request(url, options);
    }

    // **************************   Bot Methods   **********************************

    async getMe() {
        const options = {
            url: this.baseUrl + this.URLs.getMe,
        };
        return this._get(options);
    }

    async setMyCommands(commands, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.setMyCommands,
            body: {
                commands,
                ...params
            }
        };
        return this._post(options);
    }

    async getMyCommands(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.getMyCommands,
            query: params
        };
        return this._get(options);
    }

    async deleteMyCommands(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.deleteMyCommands,
            body: params
        };
        return this._post(options);
    }

    // **************************   Message Methods   **********************************

    async sendMessage(chat_id, text, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.sendMessage,
            body: {
                chat_id,
                text,
                ...params
            }
        };
        return this._post(options);
    }

    async forwardMessage(chat_id, from_chat_id, message_id, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.forwardMessage,
            body: {
                chat_id,
                from_chat_id,
                message_id,
                ...params
            }
        };
        return this._post(options);
    }

    async sendPhoto(chat_id, photo, params = {}) {
        if (typeof photo === 'string' && !photo.startsWith('http')) {
            // File upload
            const form = new FormData();
            form.append('chat_id', chat_id);
            form.append('photo', fs.createReadStream(photo));
            Object.keys(params).forEach(key => {
                form.append(key, params[key]);
            });

            const options = {
                url: this.baseUrl + this.URLs.sendPhoto,
                body: form,
                headers: form.getHeaders()
            };
            return this._post(options, false);
        } else {
            const options = {
                url: this.baseUrl + this.URLs.sendPhoto,
                body: {
                    chat_id,
                    photo,
                    ...params
                }
            };
            return this._post(options);
        }
    }

    async sendDocument(chat_id, document, params = {}) {
        if (typeof document === 'string' && !document.startsWith('http')) {
            // File upload
            const form = new FormData();
            form.append('chat_id', chat_id);
            form.append('document', fs.createReadStream(document));
            Object.keys(params).forEach(key => {
                form.append(key, params[key]);
            });

            const options = {
                url: this.baseUrl + this.URLs.sendDocument,
                body: form,
                headers: form.getHeaders()
            };
            return this._post(options, false);
        } else {
            const options = {
                url: this.baseUrl + this.URLs.sendDocument,
                body: {
                    chat_id,
                    document,
                    ...params
                }
            };
            return this._post(options);
        }
    }

    async sendVideo(chat_id, video, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.sendVideo,
            body: {
                chat_id,
                video,
                ...params
            }
        };
        return this._post(options);
    }

    async sendLocation(chat_id, latitude, longitude, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.sendLocation,
            body: {
                chat_id,
                latitude,
                longitude,
                ...params
            }
        };
        return this._post(options);
    }

    async sendChatAction(chat_id, action) {
        const options = {
            url: this.baseUrl + this.URLs.sendChatAction,
            body: {
                chat_id,
                action
            }
        };
        return this._post(options);
    }

    async deleteMessage(chat_id, message_id) {
        const options = {
            url: this.baseUrl + this.URLs.deleteMessage,
            body: {
                chat_id,
                message_id
            }
        };
        return this._post(options);
    }

    // **************************   Edit Methods   **********************************

    async editMessageText(text, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.editMessageText,
            body: {
                text,
                ...params
            }
        };
        return this._post(options);
    }

    async editMessageCaption(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.editMessageCaption,
            body: params
        };
        return this._post(options);
    }

    async editMessageReplyMarkup(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.editMessageReplyMarkup,
            body: params
        };
        return this._post(options);
    }

    // **************************   Update Methods   **********************************

    async getUpdates(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.getUpdates,
            query: params
        };
        return this._get(options);
    }

    async setWebhook(url, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.setWebhook,
            body: {
                url,
                ...params
            }
        };
        return this._post(options);
    }

    async deleteWebhook(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.deleteWebhook,
            body: params
        };
        return this._post(options);
    }

    async getWebhookInfo() {
        const options = {
            url: this.baseUrl + this.URLs.getWebhookInfo,
        };
        return this._get(options);
    }

    // **************************   Chat Methods   **********************************

    async getChat(chat_id) {
        const options = {
            url: this.baseUrl + this.URLs.getChat,
            query: { chat_id }
        };
        return this._get(options);
    }

    async getChatAdministrators(chat_id) {
        const options = {
            url: this.baseUrl + this.URLs.getChatAdministrators,
            query: { chat_id }
        };
        return this._get(options);
    }

    async getChatMemberCount(chat_id) {
        const options = {
            url: this.baseUrl + this.URLs.getChatMemberCount,
            query: { chat_id }
        };
        return this._get(options);
    }

    async getChatMember(chat_id, user_id) {
        const options = {
            url: this.baseUrl + this.URLs.getChatMember,
            query: { chat_id, user_id }
        };
        return this._get(options);
    }

    // **************************   Inline Methods   **********************************

    async answerInlineQuery(inline_query_id, results, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.answerInlineQuery,
            body: {
                inline_query_id,
                results,
                ...params
            }
        };
        return this._post(options);
    }

    async answerCallbackQuery(callback_query_id, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.answerCallbackQuery,
            body: {
                callback_query_id,
                ...params
            }
        };
        return this._post(options);
    }

    // **************************   File Methods   **********************************

    async getFile(file_id) {
        const options = {
            url: this.baseUrl + this.URLs.getFile,
            query: { file_id }
        };
        return this._get(options);
    }

    async downloadFile(file_path) {
        const fileUrl = `https://api.telegram.org/file/bot${this.bot_token}/${file_path}`;
        const options = {
            url: fileUrl,
        };
        return this._get(options);
    }

    // **************************   Webhook Handling   **********************************

    async handleWebhook(body) {
        // Process incoming webhook data
        const update = body;
        
        if (update.message) {
            return {
                type: 'message',
                data: update.message
            };
        } else if (update.edited_message) {
            return {
                type: 'edited_message',
                data: update.edited_message
            };
        } else if (update.channel_post) {
            return {
                type: 'channel_post',
                data: update.channel_post
            };
        } else if (update.edited_channel_post) {
            return {
                type: 'edited_channel_post',
                data: update.edited_channel_post
            };
        } else if (update.inline_query) {
            return {
                type: 'inline_query',
                data: update.inline_query
            };
        } else if (update.chosen_inline_result) {
            return {
                type: 'chosen_inline_result',
                data: update.chosen_inline_result
            };
        } else if (update.callback_query) {
            return {
                type: 'callback_query',
                data: update.callback_query
            };
        } else if (update.shipping_query) {
            return {
                type: 'shipping_query',
                data: update.shipping_query
            };
        } else if (update.pre_checkout_query) {
            return {
                type: 'pre_checkout_query',
                data: update.pre_checkout_query
            };
        } else if (update.poll) {
            return {
                type: 'poll',
                data: update.poll
            };
        } else if (update.poll_answer) {
            return {
                type: 'poll_answer',
                data: update.poll_answer
            };
        }
        
        return {
            type: 'unknown',
            data: update
        };
    }
}

module.exports = { Api };