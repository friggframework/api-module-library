const { OAuth2Requester } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.deepcrawl.com/v1';

        this.URLs = {
            // User
            user: '/user',
            
            // Projects
            projects: '/projects',
            projectById: (projectId) => `/projects/${projectId}`,
            
            // Crawls
            crawls: '/projects/{project_id}/crawls',
            crawlById: (crawlId) => `/crawls/${crawlId}`,
            
            // Reports
            reports: '/crawls/{crawl_id}/reports',
            reportById: (reportId) => `/reports/${reportId}`,
            
            // Issues
            issues: '/crawls/{crawl_id}/issues',
            issueById: (issueId) => `/issues/${issueId}`,
            
            // Pages
            pages: '/crawls/{crawl_id}/pages',
            pageById: (pageId) => `/pages/${pageId}`,
            
            // Accounts
            accounts: '/accounts',
            accountById: (accountId) => `/accounts/${accountId}`,
        };

        this.authorizationUri = encodeURI(
            `https://app.deepcrawl.com/oauth/authorize?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&state=${this.state}&scope=${this.scope}`
        );
        this.tokenUri = 'https://api.deepcrawl.com/oauth/token';
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

    // Projects
    async listProjects(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.projects,
            method: 'GET',
            qs: params,
        };
        return this._request(options);
    }

    async getProject(projectId) {
        const options = {
            url: this.baseUrl + this.URLs.projectById(projectId),
            method: 'GET',
        };
        return this._request(options);
    }

    // Crawls
    async listCrawls(projectId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.crawls.replace('{project_id}', projectId),
            method: 'GET',
            qs: params,
        };
        return this._request(options);
    }

    async getCrawl(crawlId) {
        const options = {
            url: this.baseUrl + this.URLs.crawlById(crawlId),
            method: 'GET',
        };
        return this._request(options);
    }

    async startCrawl(projectId, crawlData) {
        const options = {
            url: this.baseUrl + this.URLs.crawls.replace('{project_id}', projectId),
            method: 'POST',
            json: crawlData,
        };
        return this._request(options);
    }

    // Reports
    async listReports(crawlId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.reports.replace('{crawl_id}', crawlId),
            method: 'GET',
            qs: params,
        };
        return this._request(options);
    }

    // Issues
    async listIssues(crawlId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.issues.replace('{crawl_id}', crawlId),
            method: 'GET',
            qs: params,
        };
        return this._request(options);
    }

    // Pages
    async listPages(crawlId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.pages.replace('{crawl_id}', crawlId),
            method: 'GET',
            qs: params,
        };
        return this._request(options);
    }

    // User info for authentication
    async getUserDetails() {
        return this.getUser();
    }
}

module.exports = { Api };