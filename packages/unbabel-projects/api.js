const {get, OAuth2Requester} = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.customer_id = get(params, 'customer_id', null);
        Object.defineProperty(this, 'baseUrl', {
            get() {
                return `https://api.unbabel.com/projects/v0/customers/${this.customer_id}/`;
            }
        });
        this.UrlAffixes = {
            extensions: 'projects:supported-extensions',
            projects: 'projects',
            projectById: (projectId) => `projects/${projectId}`,
            projectFiles: (projectId) => `projects/${projectId}/files`,
            projectFileById: (projectId, fileId) => `projects/${projectId}/files/${fileId}`,
            projectOrders: (projectId) => `projects/${projectId}/orders`,
            projectOrderById: (projectId, orderId) => `projects/${projectId}/files/${orderId}`,
            projectOrderJobs: (projectId, orderId) => `projects/${projectId}/files/${orderId}/jobs`,
            projectOrderJobsById: (projectId, orderId, jobId) => `projects/${projectId}/files/${orderId}/jobs/${jobId}`
        };
        Object.defineProperty(this, 'URLs', {
            get() {
                const urls = {}
                for (const name of Object.keys(this.UrlAffixes)) {
                    if (this.UrlAffixes[name] instanceof Function) {
                        urls[name] = (...params) => this.baseUrl + this.UrlAffixes[name](...params);
                    } else {
                        urls[name] = this.baseUrl + this.UrlAffixes[name];
                    }

                }
                return urls;
            }
        });


        this.tokenUri = 'https://iam.unbabel.com/auth/realms/production/protocol/openid-connect/token';
    }

    async getTokenIdentity() {
        return {
            identifier: `${this.client_id}:${this.customer_id}:${this.username}`,
            name: `${this.username}`
        }
    }

    async getTokenFromUsernamePassword() {
        try {
            const form = new URLSearchParams();
            form.append('grant_type', 'password');
            form.append('client_id', this.client_id);
            form.append('username', this.username);
            form.append('password', this.password);
            const options = {
                body: form,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                url: this.tokenUri
            };

            const response = await this._post(options, false);

            await this.setTokens(response);
            return response;
        } catch (err) {
            await this.notify(this.DLGT_INVALID_AUTH);
        }
    }

    async getSupportedExtensions() {
        const options = {
            url: this.URLs.extensions,
        };
        return this._get(options);
    }

    async createProject(body, webhookUrl= null) {
        const options = {
            url: this.URLs.projects,
            body,
            headers: {
                'Content-Type': 'application/json',
            },
        }
        if (webhookUrl) {
            options.headers.Link = `${webhookUrl}; rel="delivery-callback"`;
        }
        return this._post(options);
    }

    async getProject(projectId) {
        const options = {
            url: this.URLs.projectById(projectId),
        }
        return this._get(options);
    }

    async submitProject(projectId) {
        const options = {
            url: this.URLs.projectById(projectId) + ':submit',
        }
        return this._post(options);
    }
    async cancelProject(projectId) {
        // only works on pre-submitted projects
        const options = {
            url: this.URLs.projectById(projectId),
        }
        return this._delete(options);
    }

    async addFileToProject(projectId, name, description, extension, tags= null) {
        const fileDefinition = {
            name,
            description,
            extension,
        }
        if (tags) {
            // should be of the form { tag: ['tag1', 'tag2'] }
            fileDefinition.tags = tags
        }
        const options = {
            url: this.URLs.projectFiles(projectId),
            headers: {
                'Content-Type': 'application/json',
            },
            body: fileDefinition
        }
        return this._post(options);
    }

    getFile(projectId, fileId) {
        const options = {
            url: this.URLs.projectFileById(projectId, fileId),
        }
        return this._get(options);
    }

    uploadFile(uploadUrl, file, webhookUrl= null) {
        const options = {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': 'application/json'
            }
        }
        if (webhookUrl) {
            options.headers['Link'] = `${webhookUrl};`
        }
        return fetch(uploadUrl, options);
    }

}

module.exports = {Api};
