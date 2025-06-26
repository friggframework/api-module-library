const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://docs.googleapis.com/v1';

        this.URLs = {
            // Documents
            documents: '/documents',
            documentById: (documentId) => `/documents/${documentId}`,
            
            // Batch update
            batchUpdate: (documentId) => `/documents/${documentId}:batchUpdate`,
        };

        this.authorizationUri = encodeURI(
            `https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}&scope=${this.scope}&access_type=offline`
        );
        this.tokenUri = 'https://oauth2.googleapis.com/token';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    async getTokenFromCode(code) {
        delete this.access_token;
        return super.getTokenFromCode(code);
    }

    async setTokens(params) {
        this.access_token = get(params, 'access_token');
        const newRefreshToken = get(params, 'refresh_token', null);

        if (newRefreshToken) {
            this.refresh_token = newRefreshToken;
        }

        const accessExpiresIn = get(params, 'expires_in', null);
        if (accessExpiresIn) {
            this.accessTokenExpire = new Date(Date.now() + accessExpiresIn * 1000);
        }

        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    addJsonHeaders(options) {
        const jsonHeaders = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        }
    }

    async _post(options, stringify) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // **************************   Documents   **********************************

    async createDocument(title = 'Untitled Document') {
        const options = {
            url: this.baseUrl + this.URLs.documents,
            body: {
                title: title
            },
        };
        return this._post(options);
    }

    async getDocument(documentId) {
        const options = {
            url: this.baseUrl + this.URLs.documentById(documentId),
        };
        return this._get(options);
    }

    async batchUpdateDocument(documentId, requests) {
        const options = {
            url: this.baseUrl + this.URLs.batchUpdate(documentId),
            body: {
                requests: requests
            },
        };
        return this._post(options);
    }

    async insertText(documentId, text, index = 1) {
        const requests = [
            {
                insertText: {
                    location: {
                        index: index
                    },
                    text: text
                }
            }
        ];
        return this.batchUpdateDocument(documentId, requests);
    }

    async replaceText(documentId, oldText, newText) {
        const requests = [
            {
                replaceAllText: {
                    containsText: {
                        text: oldText,
                        matchCase: false
                    },
                    replaceText: newText
                }
            }
        ];
        return this.batchUpdateDocument(documentId, requests);
    }

    async insertTable(documentId, rows, columns, index = 1) {
        const requests = [
            {
                insertTable: {
                    location: {
                        index: index
                    },
                    rows: rows,
                    columns: columns
                }
            }
        ];
        return this.batchUpdateDocument(documentId, requests);
    }

    async insertImage(documentId, imageUri, index = 1) {
        const requests = [
            {
                insertInlineImage: {
                    location: {
                        index: index
                    },
                    uri: imageUri
                }
            }
        ];
        return this.batchUpdateDocument(documentId, requests);
    }

    async formatText(documentId, startIndex, endIndex, formatting) {
        const requests = [
            {
                updateTextStyle: {
                    range: {
                        startIndex: startIndex,
                        endIndex: endIndex
                    },
                    textStyle: formatting,
                    fields: Object.keys(formatting).join(',')
                }
            }
        ];
        return this.batchUpdateDocument(documentId, requests);
    }

    async deleteContentRange(documentId, startIndex, endIndex) {
        const requests = [
            {
                deleteContentRange: {
                    range: {
                        startIndex: startIndex,
                        endIndex: endIndex
                    }
                }
            }
        ];
        return this.batchUpdateDocument(documentId, requests);
    }

    async insertPageBreak(documentId, index = 1) {
        const requests = [
            {
                insertPageBreak: {
                    location: {
                        index: index
                    }
                }
            }
        ];
        return this.batchUpdateDocument(documentId, requests);
    }

    async updateDocumentStyle(documentId, style) {
        const requests = [
            {
                updateDocumentStyle: {
                    documentStyle: style,
                    fields: Object.keys(style).join(',')
                }
            }
        ];
        return this.batchUpdateDocument(documentId, requests);
    }
}

module.exports = { Api };