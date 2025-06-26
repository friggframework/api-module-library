const { OAuth2Requester, get } = require('@friggframework/core');

// Evernote API client
// Supports OAuth2 authentication
// Documentation: https://dev.evernote.com/doc/

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        // Determine environment (sandbox or production)
        this.isSandbox = get(params, 'sandbox', false);
        
        if (this.isSandbox) {
            this.baseUrl = 'https://sandbox.evernote.com';
            this.authorizationUri = 'https://sandbox.evernote.com/OAuth.action';
        } else {
            this.baseUrl = 'https://www.evernote.com';
            this.authorizationUri = 'https://www.evernote.com/OAuth.action';
        }
        
        this.apiUrl = `${this.baseUrl}/shard/s1/notestore`;
        this.userStoreUrl = `${this.baseUrl}/edam/user`;
        
        this.client_id = get(params, 'client_id', process.env.EVERNOTE_CLIENT_ID);
        this.client_secret = get(params, 'client_secret', process.env.EVERNOTE_CLIENT_SECRET);
        this.access_token = get(params, 'access_token', null);
        this.noteStoreUrl = get(params, 'noteStoreUrl', null);
        this.webApiUrlPrefix = get(params, 'webApiUrlPrefix', null);
        
        // OAuth1.0a parameters (Evernote uses OAuth 1.0a)
        this.oauth_token = get(params, 'oauth_token', null);
        this.oauth_token_secret = get(params, 'oauth_token_secret', null);
        this.oauth_verifier = get(params, 'oauth_verifier', null);

        this.URLs = {
            // User Store API
            userStore: '/edam/user',
            checkVersion: '/edam/user/checkVersion',
            getBootstrapInfo: '/edam/user/getBootstrapInfo',
            getUser: '/edam/user/getUser',
            getPublicUserInfo: '/edam/user/getPublicUserInfo',
            getPremiumInfo: '/edam/user/getPremiumInfo',
            getNoteStoreUrl: '/edam/user/getNoteStoreUrl',
            
            // Note Store API (these are relative to noteStoreUrl)
            noteStore: '',
            listNotebooks: '/listNotebooks',
            getDefaultNotebook: '/getDefaultNotebook',
            createNotebook: '/createNotebook',
            updateNotebook: '/updateNotebook',
            expungeNotebook: '/expungeNotebook',
            
            // Notes
            createNote: '/createNote',
            updateNote: '/updateNote',
            deleteNote: '/deleteNote',
            expungeNote: '/expungeNote',
            getNote: '/getNote',
            getNoteContent: '/getNoteContent',
            getNoteSearchText: '/getNoteSearchText',
            getNoteTagNames: '/getNoteTagNames',
            getNoteAttributes: '/getNoteAttributes',
            
            // Search
            findNotes: '/findNotes',
            findNotesMetadata: '/findNotesMetadata',
            findNotesCounts: '/findNotesCounts',
            findNotesWithResultSpec: '/findNotesWithResultSpec',
            
            // Tags
            listTags: '/listTags',
            listTagsByNotebook: '/listTagsByNotebook',
            getTag: '/getTag',
            createTag: '/createTag',
            updateTag: '/updateTag',
            untagAll: '/untagAll',
            expungeTag: '/expungeTag',
            
            // Resources (attachments)
            createResource: '/createResource',
            updateResource: '/updateResource',
            getResource: '/getResource',
            getResourceData: '/getResourceData',
            getResourceByHash: '/getResourceByHash',
            getResourceAttributes: '/getResourceAttributes',
            
            // Saved Searches
            listSearches: '/listSearches',
            getSearch: '/getSearch',
            createSearch: '/createSearch',
            updateSearch: '/updateSearch',
            expungeSearch: '/expungeSearch',
            
            // Linked notebooks (shared notebooks)
            listLinkedNotebooks: '/listLinkedNotebooks',
            getLinkedNotebook: '/getLinkedNotebook',
            createLinkedNotebook: '/createLinkedNotebook',
            updateLinkedNotebook: '/updateLinkedNotebook',
            expungeLinkedNotebook: '/expungeLinkedNotebook',
            
            // Shared notebooks
            shareNotebook: '/shareNotebook',
            createSharedNotebook: '/createSharedNotebook',
            updateSharedNotebook: '/updateSharedNotebook',
            setSharedNotebookRecipientSettings: '/setSharedNotebookRecipientSettings',
            sendMessageToSharedNotebookMembers: '/sendMessageToSharedNotebookMembers',
            listSharedNotebooks: '/listSharedNotebooks',
            expungeSharedNotebooks: '/expungeSharedNotebooks',
            
            // Business/Teams
            getSharedNotebookByAuth: '/getSharedNotebookByAuth',
            emailNote: '/emailNote',
            shareNote: '/shareNote',
            stopSharingNote: '/stopSharingNote',
            authenticateToSharedNotebook: '/authenticateToSharedNotebook',
            
            // Sync
            getSyncState: '/getSyncState',
            getSyncChunk: '/getSyncChunk',
            getFilteredSyncChunk: '/getFilteredSyncChunk',
            getLinkedNotebookSyncState: '/getLinkedNotebookSyncState',
            getLinkedNotebookSyncChunk: '/getLinkedNotebookSyncChunk',
            
            // Webhooks
            createWebhook: '/createWebhook',
            deleteWebhook: '/deleteWebhook',
            listWebhooks: '/listWebhooks',
            
            // OAuth
            requestToken: '/oauth',
            authorize: '/OAuth.action',
            accessToken: '/oauth',
        };

        // ENML (Evernote Markup Language) helper
        this.enmlHeader = '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note>';
        this.enmlFooter = '</en-note>';
    }

    // OAuth 1.0a flow for Evernote
    async getRequestToken() {
        const options = {
            url: `${this.baseUrl}${this.URLs.requestToken}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'oauth_callback': this.redirect_uri,
                'oauth_consumer_key': this.client_id,
                'oauth_signature_method': 'HMAC-SHA1',
                'oauth_timestamp': Math.floor(Date.now() / 1000),
                'oauth_nonce': Math.random().toString(36).substring(2, 15),
                'oauth_version': '1.0'
            })
        };
        
        // Note: Full OAuth 1.0a signature generation would be needed here
        // This is a simplified version - production code should use a proper OAuth library
        return this._post(options, false);
    }

    getAuthUri(requestToken) {
        const params = new URLSearchParams({
            oauth_token: requestToken,
            oauth_callback: this.redirect_uri,
        });
        
        return `${this.authorizationUri}?${params.toString()}`;
    }

    async getAccessToken(requestToken, requestTokenSecret, verifier) {
        const options = {
            url: `${this.baseUrl}${this.URLs.accessToken}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'oauth_token': requestToken,
                'oauth_verifier': verifier,
                'oauth_consumer_key': this.client_id,
                'oauth_signature_method': 'HMAC-SHA1',
                'oauth_timestamp': Math.floor(Date.now() / 1000),
                'oauth_nonce': Math.random().toString(36).substring(2, 15),
                'oauth_version': '1.0'
            })
        };
        
        // Note: Full OAuth 1.0a signature generation would be needed here
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    async setTokens(tokenResponse) {
        this.access_token = tokenResponse.oauth_token;
        this.oauth_token_secret = tokenResponse.oauth_token_secret;
        this.noteStoreUrl = tokenResponse.edam_noteStoreUrl;
        this.webApiUrlPrefix = tokenResponse.edam_webApiUrlPrefix;
        
        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    // Add authentication headers for API requests
    addAuthHeaders(options) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${this.access_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
    }

    async _get(options, useNoteStore = false) {
        const baseUrl = useNoteStore && this.noteStoreUrl ? this.noteStoreUrl : this.baseUrl;
        options.url = baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._get(options);
    }

    async _post(options, stringify = true, useNoteStore = false) {
        const baseUrl = useNoteStore && this.noteStoreUrl ? this.noteStoreUrl : this.baseUrl;
        options.url = baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._post(options, stringify);
    }

    async _put(options, stringify = true, useNoteStore = false) {
        const baseUrl = useNoteStore && this.noteStoreUrl ? this.noteStoreUrl : this.baseUrl;
        options.url = baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._put(options, stringify);
    }

    async _delete(options, useNoteStore = false) {
        const baseUrl = useNoteStore && this.noteStoreUrl ? this.noteStoreUrl : this.baseUrl;
        options.url = baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._delete(options);
    }

    // **************************   User Store Methods   **********************************

    async getUser() {
        const options = {
            url: this.URLs.getUser,
        };
        return this._get(options);
    }

    async getBootstrapInfo(locale = 'en') {
        const options = {
            url: this.URLs.getBootstrapInfo,
            query: { locale }
        };
        return this._get(options);
    }

    async getPremiumInfo() {
        const options = {
            url: this.URLs.getPremiumInfo,
        };
        return this._get(options);
    }

    async getNoteStoreUrl() {
        const options = {
            url: this.URLs.getNoteStoreUrl,
        };
        return this._get(options);
    }

    // **************************   Notebooks   **********************************

    async listNotebooks() {
        const options = {
            url: this.URLs.listNotebooks,
        };
        return this._get(options, true);
    }

    async getDefaultNotebook() {
        const options = {
            url: this.URLs.getDefaultNotebook,
        };
        return this._get(options, true);
    }

    async createNotebook(notebookData) {
        const options = {
            url: this.URLs.createNotebook,
            body: notebookData,
        };
        return this._post(options, true, true);
    }

    async updateNotebook(notebookData) {
        const options = {
            url: this.URLs.updateNotebook,
            body: notebookData,
        };
        return this._post(options, true, true);
    }

    async expungeNotebook(notebookGuid) {
        const options = {
            url: this.URLs.expungeNotebook,
            body: { guid: notebookGuid },
        };
        return this._post(options, true, true);
    }

    // **************************   Notes   **********************************

    async createNote(noteData) {
        // Ensure content is wrapped in ENML
        if (noteData.content && !noteData.content.includes('<en-note>')) {
            noteData.content = this.enmlHeader + noteData.content + this.enmlFooter;
        }
        
        const options = {
            url: this.URLs.createNote,
            body: noteData,
        };
        return this._post(options, true, true);
    }

    async updateNote(noteData) {
        // Ensure content is wrapped in ENML
        if (noteData.content && !noteData.content.includes('<en-note>')) {
            noteData.content = this.enmlHeader + noteData.content + this.enmlFooter;
        }
        
        const options = {
            url: this.URLs.updateNote,
            body: noteData,
        };
        return this._post(options, true, true);
    }

    async getNote(noteGuid, withContent = true, withResourcesData = false, withResourcesRecognition = false, withResourcesAlternateData = false) {
        const options = {
            url: this.URLs.getNote,
            body: {
                guid: noteGuid,
                withContent,
                withResourcesData,
                withResourcesRecognition,
                withResourcesAlternateData
            },
        };
        return this._post(options, true, true);
    }

    async getNoteContent(noteGuid) {
        const options = {
            url: this.URLs.getNoteContent,
            body: { guid: noteGuid },
        };
        return this._post(options, true, true);
    }

    async deleteNote(noteGuid) {
        const options = {
            url: this.URLs.deleteNote,
            body: { guid: noteGuid },
        };
        return this._post(options, true, true);
    }

    async expungeNote(noteGuid) {
        const options = {
            url: this.URLs.expungeNote,
            body: { guid: noteGuid },
        };
        return this._post(options, true, true);
    }

    async getNoteTagNames(noteGuid) {
        const options = {
            url: this.URLs.getNoteTagNames,
            body: { guid: noteGuid },
        };
        return this._post(options, true, true);
    }

    // **************************   Search   **********************************

    async findNotes(filter, offset = 0, maxNotes = 100) {
        const options = {
            url: this.URLs.findNotes,
            body: {
                filter: {
                    query: filter,
                    ascending: false,
                    order: 1, // CREATED
                },
                offset,
                maxNotes
            },
        };
        return this._post(options, true, true);
    }

    async findNotesMetadata(filter, offset = 0, maxNotes = 100, resultSpec = {}) {
        const options = {
            url: this.URLs.findNotesMetadata,
            body: {
                filter: {
                    query: filter,
                    ascending: false,
                    order: 1, // CREATED
                },
                offset,
                maxNotes,
                resultSpec: {
                    includeTitle: true,
                    includeContentLength: true,
                    includeCreated: true,
                    includeUpdated: true,
                    includeDeleted: false,
                    includeUpdateSequenceNum: true,
                    includeNotebookGuid: true,
                    includeTagGuids: true,
                    includeAttributes: true,
                    includeLargestResourceMime: true,
                    includeLargestResourceSize: true,
                    ...resultSpec
                }
            },
        };
        return this._post(options, true, true);
    }

    async searchNotes(query, notebookGuid = null, tagGuids = [], offset = 0, maxNotes = 100) {
        let filter = query;
        
        if (notebookGuid) {
            filter += ` notebook:"${notebookGuid}"`;
        }
        
        if (tagGuids && tagGuids.length > 0) {
            filter += ` tag:"${tagGuids.join('" tag:"')}"`;
        }
        
        return this.findNotesMetadata(filter, offset, maxNotes);
    }

    // **************************   Tags   **********************************

    async listTags() {
        const options = {
            url: this.URLs.listTags,
        };
        return this._get(options, true);
    }

    async listTagsByNotebook(notebookGuid) {
        const options = {
            url: this.URLs.listTagsByNotebook,
            body: { notebookGuid },
        };
        return this._post(options, true, true);
    }

    async getTag(tagGuid) {
        const options = {
            url: this.URLs.getTag,
            body: { guid: tagGuid },
        };
        return this._post(options, true, true);
    }

    async createTag(tagData) {
        const options = {
            url: this.URLs.createTag,
            body: tagData,
        };
        return this._post(options, true, true);
    }

    async updateTag(tagData) {
        const options = {
            url: this.URLs.updateTag,
            body: tagData,
        };
        return this._post(options, true, true);
    }

    async expungeTag(tagGuid) {
        const options = {
            url: this.URLs.expungeTag,
            body: { guid: tagGuid },
        };
        return this._post(options, true, true);
    }

    // **************************   Resources (Attachments)   **********************************

    async createResource(resourceData) {
        const options = {
            url: this.URLs.createResource,
            body: resourceData,
        };
        return this._post(options, true, true);
    }

    async getResource(resourceGuid, withData = true, withRecognition = false, withAttributes = true, withAlternateData = false) {
        const options = {
            url: this.URLs.getResource,
            body: {
                guid: resourceGuid,
                withData,
                withRecognition,
                withAttributes,
                withAlternateData
            },
        };
        return this._post(options, true, true);
    }

    async getResourceData(resourceGuid) {
        const options = {
            url: this.URLs.getResourceData,
            body: { guid: resourceGuid },
        };
        return this._post(options, true, true);
    }

    async updateResource(resourceData) {
        const options = {
            url: this.URLs.updateResource,
            body: resourceData,
        };
        return this._post(options, true, true);
    }

    // **************************   Saved Searches   **********************************

    async listSearches() {
        const options = {
            url: this.URLs.listSearches,
        };
        return this._get(options, true);
    }

    async getSearch(searchGuid) {
        const options = {
            url: this.URLs.getSearch,
            body: { guid: searchGuid },
        };
        return this._post(options, true, true);
    }

    async createSearch(searchData) {
        const options = {
            url: this.URLs.createSearch,
            body: searchData,
        };
        return this._post(options, true, true);
    }

    async updateSearch(searchData) {
        const options = {
            url: this.URLs.updateSearch,
            body: searchData,
        };
        return this._post(options, true, true);
    }

    async expungeSearch(searchGuid) {
        const options = {
            url: this.URLs.expungeSearch,
            body: { guid: searchGuid },
        };
        return this._post(options, true, true);
    }

    // **************************   Sharing   **********************************

    async shareNotebook(notebookGuid, message = '') {
        const options = {
            url: this.URLs.shareNotebook,
            body: {
                guid: notebookGuid,
                message
            },
        };
        return this._post(options, true, true);
    }

    async shareNote(noteGuid) {
        const options = {
            url: this.URLs.shareNote,
            body: { guid: noteGuid },
        };
        return this._post(options, true, true);
    }

    async stopSharingNote(noteGuid) {
        const options = {
            url: this.URLs.stopSharingNote,
            body: { guid: noteGuid },
        };
        return this._post(options, true, true);
    }

    async listSharedNotebooks() {
        const options = {
            url: this.URLs.listSharedNotebooks,
        };
        return this._get(options, true);
    }

    async createSharedNotebook(sharedNotebookData) {
        const options = {
            url: this.URLs.createSharedNotebook,
            body: sharedNotebookData,
        };
        return this._post(options, true, true);
    }

    async emailNote(noteGuid, message, recipients, ccAddresses = []) {
        const options = {
            url: this.URLs.emailNote,
            body: {
                guid: noteGuid,
                message,
                recipients,
                ccAddresses
            },
        };
        return this._post(options, true, true);
    }

    // **************************   Sync   **********************************

    async getSyncState() {
        const options = {
            url: this.URLs.getSyncState,
        };
        return this._get(options, true);
    }

    async getSyncChunk(afterUSN, maxEntries = 100, fullSyncOnly = false) {
        const options = {
            url: this.URLs.getSyncChunk,
            body: {
                afterUSN,
                maxEntries,
                fullSyncOnly
            },
        };
        return this._post(options, true, true);
    }

    // **************************   Helper Methods   **********************************

    // Convert plain text to ENML
    textToENML(text) {
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br/>');
        
        return this.enmlHeader + escaped + this.enmlFooter;
    }

    // Convert HTML to ENML (basic conversion)
    htmlToENML(html) {
        // Basic HTML to ENML conversion
        // In production, you'd want a more robust HTML parser
        const enmlContent = html
            .replace(/<(?!\/?(br|p|div|span|b|i|u|s|strike|strong|em|font|a|img|ul|ol|li|table|tr|td|th|tbody|thead|tfoot|h1|h2|h3|h4|h5|h6|blockquote|cite|abbr|acronym|del|ins|sub|sup|tt|code|kbd|samp|var)(\s|\/|>))/gi, '&lt;')
            .replace(/style\s*=\s*["'][^"']*["']/gi, '') // Remove style attributes
            .replace(/class\s*=\s*["'][^"']*["']/gi, '') // Remove class attributes
            .replace(/id\s*=\s*["'][^"']*["']/gi, ''); // Remove id attributes
        
        return this.enmlHeader + enmlContent + this.enmlFooter;
    }

    // Extract plain text from ENML
    enmlToText(enml) {
        return enml
            .replace(/<[^>]*>/g, '') // Remove all tags
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&nbsp;/g, ' ')
            .trim();
    }

    // Create a simple text note
    async createTextNote(title, content, notebookGuid = null, tagNames = []) {
        const noteData = {
            title,
            content: this.textToENML(content),
            tagNames
        };
        
        if (notebookGuid) {
            noteData.notebookGuid = notebookGuid;
        }
        
        return this.createNote(noteData);
    }

    // Create an HTML note
    async createHtmlNote(title, htmlContent, notebookGuid = null, tagNames = []) {
        const noteData = {
            title,
            content: this.htmlToENML(htmlContent),
            tagNames
        };
        
        if (notebookGuid) {
            noteData.notebookGuid = notebookGuid;
        }
        
        return this.createNote(noteData);
    }

    // Get all notes in a notebook
    async getNotesInNotebook(notebookGuid, maxNotes = 100) {
        return this.searchNotes('', notebookGuid, [], 0, maxNotes);
    }

    // Get notes by tag
    async getNotesByTag(tagName, maxNotes = 100) {
        return this.searchNotes(`tag:"${tagName}"`, null, [], 0, maxNotes);
    }

    // Get recent notes
    async getRecentNotes(days = 7, maxNotes = 50) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        const dateStr = date.toISOString().split('T')[0];
        
        return this.searchNotes(`created:${dateStr}`, null, [], 0, maxNotes);
    }
}

module.exports = { Api };