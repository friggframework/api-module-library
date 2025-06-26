const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = 'https://api.typeform.com';
        
        this.URLs = {
            authorization: '/oauth/authorize',
            access_token: '/oauth/token',
            
            // User/Account
            me: '/me',
            
            // Forms
            forms: '/forms',
            formById: (formId) => `/forms/${formId}`,
            formMessages: (formId) => `/forms/${formId}/messages`,
            
            // Responses
            formResponses: (formId) => `/forms/${formId}/responses`,
            
            // Images
            images: '/images',
            imageById: (imageId) => `/images/${imageId}`,
            
            // Themes
            themes: '/themes',
            themeById: (themeId) => `/themes/${themeId}`,
            
            // Workspaces
            workspaces: '/workspaces',
            workspaceById: (workspaceId) => `/workspaces/${workspaceId}`,
            workspaceForms: (workspaceId) => `/workspaces/${workspaceId}/forms`,
            
            // Webhooks
            formWebhooks: (formId) => `/forms/${formId}/webhooks`,
            formWebhookById: (formId, webhookTag) => `/forms/${formId}/webhooks/${webhookTag}`,
        };

        this.authorizationUri = encodeURI(
            `https://admin.typeform.com/oauth/authorize?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&scope=${this.scope}&response_type=code&state=${this.state}`
        );
        this.tokenUri = 'https://api.typeform.com/oauth/token';

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

    // **************************   User/Account Methods   **********************************

    async getMe() {
        const options = {
            url: this.baseUrl + this.URLs.me,
        };
        return this._get(options);
    }

    // **************************   Forms Methods   **********************************

    async getForms(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.forms,
            query: params,
        };
        return this._get(options);
    }

    async createForm(formData) {
        const options = {
            url: this.baseUrl + this.URLs.forms,
            body: formData,
        };
        return this._post(options);
    }

    async getForm(formId) {
        const options = {
            url: this.baseUrl + this.URLs.formById(formId),
        };
        return this._get(options);
    }

    async updateForm(formId, formData) {
        const options = {
            url: this.baseUrl + this.URLs.formById(formId),
            body: formData,
        };
        return this._put(options);
    }

    async deleteForm(formId) {
        const options = {
            url: this.baseUrl + this.URLs.formById(formId),
        };
        return this._delete(options);
    }

    async duplicateForm(formId, targetWorkspaceHref = null) {
        const body = {};
        if (targetWorkspaceHref) {
            body.target_workspace_href = targetWorkspaceHref;
        }

        const options = {
            url: this.baseUrl + this.URLs.formById(formId) + '/copy',
            body,
        };
        return this._post(options);
    }

    // **************************   Form Messages Methods   **********************************

    async getFormMessages(formId) {
        const options = {
            url: this.baseUrl + this.URLs.formMessages(formId),
        };
        return this._get(options);
    }

    async updateFormMessages(formId, messagesData) {
        const options = {
            url: this.baseUrl + this.URLs.formMessages(formId),
            body: messagesData,
        };
        return this._put(options);
    }

    // **************************   Responses Methods   **********************************

    async getFormResponses(formId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.formResponses(formId),
            query: params,
        };
        return this._get(options);
    }

    async deleteFormResponses(formId, responseIds) {
        const options = {
            url: this.baseUrl + this.URLs.formResponses(formId),
            body: { included_response_ids: responseIds },
        };
        return this._delete(options);
    }

    // **************************   Images Methods   **********************************

    async getImages() {
        const options = {
            url: this.baseUrl + this.URLs.images,
        };
        return this._get(options);
    }

    async uploadImage(imageData) {
        // Note: This requires multipart/form-data, not JSON
        const options = {
            url: this.baseUrl + this.URLs.images,
            body: imageData,
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        };
        return this._post(options, false);
    }

    async getImage(imageId) {
        const options = {
            url: this.baseUrl + this.URLs.imageById(imageId),
        };
        return this._get(options);
    }

    async deleteImage(imageId) {
        const options = {
            url: this.baseUrl + this.URLs.imageById(imageId),
        };
        return this._delete(options);
    }

    // **************************   Themes Methods   **********************************

    async getThemes(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.themes,
            query: params,
        };
        return this._get(options);
    }

    async createTheme(themeData) {
        const options = {
            url: this.baseUrl + this.URLs.themes,
            body: themeData,
        };
        return this._post(options);
    }

    async getTheme(themeId) {
        const options = {
            url: this.baseUrl + this.URLs.themeById(themeId),
        };
        return this._get(options);
    }

    async updateTheme(themeId, themeData) {
        const options = {
            url: this.baseUrl + this.URLs.themeById(themeId),
            body: themeData,
        };
        return this._put(options);
    }

    async deleteTheme(themeId) {
        const options = {
            url: this.baseUrl + this.URLs.themeById(themeId),
        };
        return this._delete(options);
    }

    // **************************   Workspaces Methods   **********************************

    async getWorkspaces(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.workspaces,
            query: params,
        };
        return this._get(options);
    }

    async createWorkspace(workspaceData) {
        const options = {
            url: this.baseUrl + this.URLs.workspaces,
            body: workspaceData,
        };
        return this._post(options);
    }

    async getWorkspace(workspaceId) {
        const options = {
            url: this.baseUrl + this.URLs.workspaceById(workspaceId),
        };
        return this._get(options);
    }

    async updateWorkspace(workspaceId, workspaceData) {
        const options = {
            url: this.baseUrl + this.URLs.workspaceById(workspaceId),
            body: workspaceData,
        };
        return this._patch(options);
    }

    async deleteWorkspace(workspaceId) {
        const options = {
            url: this.baseUrl + this.URLs.workspaceById(workspaceId),
        };
        return this._delete(options);
    }

    async getWorkspaceForms(workspaceId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.workspaceForms(workspaceId),
            query: params,
        };
        return this._get(options);
    }

    // **************************   Webhooks Methods   **********************************

    async getFormWebhooks(formId) {
        const options = {
            url: this.baseUrl + this.URLs.formWebhooks(formId),
        };
        return this._get(options);
    }

    async createFormWebhook(formId, webhookData) {
        const options = {
            url: this.baseUrl + this.URLs.formWebhooks(formId),
            body: webhookData,
        };
        return this._post(options);
    }

    async getFormWebhook(formId, webhookTag) {
        const options = {
            url: this.baseUrl + this.URLs.formWebhookById(formId, webhookTag),
        };
        return this._get(options);
    }

    async updateFormWebhook(formId, webhookTag, webhookData) {
        const options = {
            url: this.baseUrl + this.URLs.formWebhookById(formId, webhookTag),
            body: webhookData,
        };
        return this._put(options);
    }

    async deleteFormWebhook(formId, webhookTag) {
        const options = {
            url: this.baseUrl + this.URLs.formWebhookById(formId, webhookTag),
        };
        return this._delete(options);
    }

    // **************************   Helper Methods   **********************************

    async createSimpleForm(title, fields, workspaceHref = null) {
        const formData = {
            title: title,
            fields: fields.map((field, index) => ({
                id: `field_${index + 1}`,
                title: field.title,
                type: field.type,
                properties: field.properties || {},
                validations: field.validations || {}
            })),
            settings: {
                is_public: true,
                is_trial: false
            }
        };

        if (workspaceHref) {
            formData.workspace = { href: workspaceHref };
        }

        return this.createForm(formData);
    }

    async getFormResponsesSince(formId, since) {
        const params = {
            since: since,
            completed: true
        };
        return this.getFormResponses(formId, params);
    }

    async getFormResponsesWithAnswers(formId, params = {}) {
        const defaultParams = {
            completed: true,
            ...params
        };
        return this.getFormResponses(formId, defaultParams);
    }

    async searchForms(searchTerm, workspaceId = null) {
        const params = {
            search: searchTerm
        };
        
        if (workspaceId) {
            params.workspace_id = workspaceId;
        }
        
        return this.getForms(params);
    }

    // Extract answer values from response
    extractAnswers(response) {
        const answers = {};
        
        if (response.answers) {
            response.answers.forEach(answer => {
                const fieldId = answer.field.id;
                
                // Extract value based on field type
                if (answer.text) {
                    answers[fieldId] = answer.text;
                } else if (answer.email) {
                    answers[fieldId] = answer.email;
                } else if (answer.number) {
                    answers[fieldId] = answer.number;
                } else if (answer.boolean !== undefined) {
                    answers[fieldId] = answer.boolean;
                } else if (answer.choice) {
                    answers[fieldId] = answer.choice.label;
                } else if (answer.choices) {
                    answers[fieldId] = answer.choices.labels;
                } else if (answer.date) {
                    answers[fieldId] = answer.date;
                } else if (answer.file_url) {
                    answers[fieldId] = answer.file_url;
                }
            });
        }
        
        return answers;
    }
}

module.exports = { Api };