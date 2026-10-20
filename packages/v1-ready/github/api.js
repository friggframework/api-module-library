const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * GitHub REST API client (api.github.com).
 *
 * Auth: OAuth App authorization-code flow. Access tokens are sent as
 * `Authorization: Bearer <token>` (GitHub also accepts the legacy `token`
 * prefix; Bearer is the documented form for OAuth tokens).
 *
 *   Authorize: https://github.com/login/oauth/authorize
 *   Token:     https://github.com/login/oauth/access_token
 *   Base URL:  https://api.github.com
 *
 * Required request headers on API calls (per official docs):
 *   Accept: application/vnd.github+json
 *   X-GitHub-Api-Version: 2022-11-28
 *
 * Docs:
 *   https://docs.github.com/en/rest
 *   https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 * Official OpenAPI:
 *   https://github.com/github/rest-api-description
 *
 * The curated contract in ./github.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://api.github.com';
        // OAuth2Requester also reads baseURL; keep both aligned.
        this.baseURL = this.baseUrl;

        this.tokenUri = 'https://github.com/login/oauth/access_token';
        this.authorizationUri = this._buildAuthorizationUri();

        this.apiVersion = get(params, 'api_version', null) || '2022-11-28';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.URLs = {
            user: '/user',
            userRepos: '/user/repos',
            userOrgs: '/user/orgs',
            repo: (owner, repo) => `/repos/${owner}/${repo}`,
            repoIssues: (owner, repo) => `/repos/${owner}/${repo}/issues`,
            repoIssue: (owner, repo, issueNumber) =>
                `/repos/${owner}/${repo}/issues/${issueNumber}`,
            repoPulls: (owner, repo) => `/repos/${owner}/${repo}/pulls`,
            repoPull: (owner, repo, pullNumber) =>
                `/repos/${owner}/${repo}/pulls/${pullNumber}`,
            repoHooks: (owner, repo) => `/repos/${owner}/${repo}/hooks`,
            repoHook: (owner, repo, hookId) =>
                `/repos/${owner}/${repo}/hooks/${hookId}`,
        };
    }

    _buildAuthorizationUri() {
        const clientId = this.client_id || '';
        const redirectUri = this.redirect_uri || '';
        const scope = this.scope || '';
        const state = this.state || '';
        return encodeURI(
            `https://github.com/login/oauth/authorize?response_type=code` +
                `&client_id=${clientId}` +
                `&redirect_uri=${redirectUri}` +
                `&scope=${scope}` +
                `&state=${state}`
        );
    }

    getAuthorizationUri() {
        this.authorizationUri = this._buildAuthorizationUri();
        return this.authorizationUri;
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
        };
    }

    /**
     * GitHub's token endpoint returns application/x-www-form-urlencoded unless
     * Accept: application/json is set. It also does not require grant_type
     * (though it tolerates authorization_code). Scope is optional.
     */
    async getTokenFromCode(code) {
        const params = new URLSearchParams();
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('code', code);
        if (this.redirect_uri) {
            params.append('redirect_uri', this.redirect_uri);
        }
        const options = {
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            url: this.tokenUri,
        };
        // Avoid sending a stale Bearer header on the token exchange.
        const prior = this.access_token;
        delete this.access_token;
        try {
            const response = await this._post(options, false);
            await this.setTokens(response);
            return response;
        } catch (err) {
            if (prior) this.access_token = prior;
            throw err;
        }
    }

    /**
     * Refresh when the OAuth App has expiring tokens enabled (or requested
     * offline_access). See GitHub "Refreshing user access tokens".
     */
    async refreshAccessToken(refreshTokenObject) {
        const refreshToken =
            (refreshTokenObject && refreshTokenObject.refresh_token) ||
            this.refresh_token;
        const params = new URLSearchParams();
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshToken);
        const options = {
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            url: this.tokenUri,
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    /** GitHub-required Accept + API-Version headers on every REST call. */
    _githubHeaders(extra = {}) {
        return {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': this.apiVersion,
            ...extra,
        };
    }

    async _get(options) {
        options.headers = this._githubHeaders(options.headers);
        return super._get(options);
    }

    async _post(options, stringify) {
        // Token endpoint must not get vnd.github Accept.
        if (options.url === this.tokenUri) {
            return super._post(options, stringify);
        }
        options.headers = this._githubHeaders({
            'Content-Type': 'application/json',
            ...options.headers,
        });
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        options.headers = this._githubHeaders({
            'Content-Type': 'application/json',
            ...options.headers,
        });
        return super._patch(options, stringify);
    }

    async _put(options, stringify) {
        options.headers = this._githubHeaders({
            'Content-Type': 'application/json',
            ...options.headers,
        });
        return super._put(options, stringify);
    }

    async _delete(options) {
        options.headers = this._githubHeaders(options.headers);
        return super._delete(options);
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Get the authenticated user.
     * GET /user
     * Official operationId: users/get-authenticated
     * Docs: https://docs.github.com/rest/users/users#get-the-authenticated-user
     * Scope: read:user (or user) for the private-user response shape.
     */
    async getAuthenticatedUser() {
        return this._get({ url: this.baseUrl + this.URLs.user });
    }

    /**
     * List organizations for the authenticated user.
     * GET /user/orgs
     * Official operationId: orgs/list-for-authenticated-user
     * Docs: https://docs.github.com/rest/orgs/orgs#list-organizations-for-the-authenticated-user
     * Scope: read:org for private org membership.
     */
    async listOrganizationsForAuthenticatedUser(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.userOrgs,
            query,
        });
    }

    // ---- Repositories ------------------------------------------------------

    /**
     * List repositories for the authenticated user.
     * GET /user/repos
     * Official operationId: repos/list-for-authenticated-user
     * Docs: https://docs.github.com/rest/repos/repos#list-repositories-for-the-authenticated-user
     * Query (official): visibility, affiliation, type, sort, direction,
     * per_page, page, since, before.
     */
    async listReposForAuthenticatedUser(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.userRepos,
            query,
        });
    }

    /**
     * Create a repository for the authenticated user.
     * POST /user/repos
     * Official operationId: repos/create-for-authenticated-user
     * Docs: https://docs.github.com/rest/repos/repos#create-a-repository-for-the-authenticated-user
     * Scope: public_repo or repo.
     * Body: { name (required), description, homepage, private, ... }
     */
    async createRepositoryForAuthenticatedUser(data) {
        return this._post({
            url: this.baseUrl + this.URLs.userRepos,
            body: data,
        });
    }

    /**
     * Get a repository.
     * GET /repos/{owner}/{repo}
     * Official operationId: repos/get
     * Docs: https://docs.github.com/rest/repos/repos#get-a-repository
     */
    async getRepository(owner, repo) {
        return this._get({
            url: this.baseUrl + this.URLs.repo(owner, repo),
        });
    }

    /**
     * Update a repository.
     * PATCH /repos/{owner}/{repo}
     * Official operationId: repos/update
     * Docs: https://docs.github.com/rest/repos/repos#update-a-repository
     */
    async updateRepository(owner, repo, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.repo(owner, repo),
            body: data,
        });
    }

    // ---- Issues ------------------------------------------------------------

    /**
     * List issues for a repository.
     * GET /repos/{owner}/{repo}/issues
     * Official operationId: issues/list-for-repo
     * Docs: https://docs.github.com/rest/issues/issues#list-repository-issues
     * Note: GitHub's issues list also returns pull requests (each PR is an
     * issue). Query (official): milestone, state, assignee, type, creator,
     * mentioned, issue_field_values, labels, sort, direction, since,
     * per_page, page.
     */
    async listRepositoryIssues(owner, repo, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.repoIssues(owner, repo),
            query,
        });
    }

    /**
     * Get an issue.
     * GET /repos/{owner}/{repo}/issues/{issue_number}
     * Official operationId: issues/get
     * Docs: https://docs.github.com/rest/issues/issues#get-an-issue
     */
    async getIssue(owner, repo, issueNumber) {
        return this._get({
            url: this.baseUrl + this.URLs.repoIssue(owner, repo, issueNumber),
        });
    }

    /**
     * Create an issue.
     * POST /repos/{owner}/{repo}/issues
     * Official operationId: issues/create
     * Docs: https://docs.github.com/rest/issues/issues#create-an-issue
     * Scope: public_repo or repo. Body: { title (required; string|integer),
     * body, assignee, assignees, labels (string|object items), milestone,
     * type, parent_issue_id, ... }
     */
    async createIssue(owner, repo, data) {
        return this._post({
            url: this.baseUrl + this.URLs.repoIssues(owner, repo),
            body: data,
        });
    }

    /**
     * Update an issue.
     * PATCH /repos/{owner}/{repo}/issues/{issue_number}
     * Official operationId: issues/update
     * Docs: https://docs.github.com/rest/issues/issues#update-an-issue
     */
    async updateIssue(owner, repo, issueNumber, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.repoIssue(owner, repo, issueNumber),
            body: data,
        });
    }

    // ---- Pull requests -----------------------------------------------------

    /**
     * List pull requests.
     * GET /repos/{owner}/{repo}/pulls
     * Official operationId: pulls/list
     * Docs: https://docs.github.com/rest/pulls/pulls#list-pull-requests
     */
    async listPullRequests(owner, repo, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.repoPulls(owner, repo),
            query,
        });
    }

    /**
     * Get a pull request.
     * GET /repos/{owner}/{repo}/pulls/{pull_number}
     * Official operationId: pulls/get
     * Docs: https://docs.github.com/rest/pulls/pulls#get-a-pull-request
     */
    async getPullRequest(owner, repo, pullNumber) {
        return this._get({
            url: this.baseUrl + this.URLs.repoPull(owner, repo, pullNumber),
        });
    }

    /**
     * Create a pull request.
     * POST /repos/{owner}/{repo}/pulls
     * Official operationId: pulls/create
     * Docs: https://docs.github.com/rest/pulls/pulls#create-a-pull-request
     * Body: { head, base (required), title (required unless issue), issue
     * (required unless title), head_repo, body, draft, maintainer_can_modify }
     */
    async createPullRequest(owner, repo, data) {
        return this._post({
            url: this.baseUrl + this.URLs.repoPulls(owner, repo),
            body: data,
        });
    }

    /**
     * Update a pull request.
     * PATCH /repos/{owner}/{repo}/pulls/{pull_number}
     * Official operationId: pulls/update
     * Docs: https://docs.github.com/rest/pulls/pulls#update-a-pull-request
     */
    async updatePullRequest(owner, repo, pullNumber, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.repoPull(owner, repo, pullNumber),
            body: data,
        });
    }

    // ---- Repository webhooks -----------------------------------------------

    /**
     * List repository webhooks.
     * GET /repos/{owner}/{repo}/hooks
     * Official operationId: repos/list-webhooks
     * Docs: https://docs.github.com/rest/repos/webhooks#list-repository-webhooks
     * Scope: admin:repo_hook or repo.
     */
    async listRepositoryWebhooks(owner, repo, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.repoHooks(owner, repo),
            query,
        });
    }

    /**
     * Get a repository webhook.
     * GET /repos/{owner}/{repo}/hooks/{hook_id}
     * Official operationId: repos/get-webhook
     * Docs: https://docs.github.com/rest/repos/webhooks#get-a-repository-webhook
     */
    async getRepositoryWebhook(owner, repo, hookId) {
        return this._get({
            url: this.baseUrl + this.URLs.repoHook(owner, repo, hookId),
        });
    }

    /**
     * Create a repository webhook.
     * POST /repos/{owner}/{repo}/hooks
     * Official operationId: repos/create-webhook
     * Docs: https://docs.github.com/rest/repos/webhooks#create-a-repository-webhook
     * Body: { name: 'web', config: { url, content_type, secret, insecure_ssl },
     *         events, active }
     */
    async createRepositoryWebhook(owner, repo, data) {
        return this._post({
            url: this.baseUrl + this.URLs.repoHooks(owner, repo),
            body: data,
        });
    }

    /**
     * Update a repository webhook.
     * PATCH /repos/{owner}/{repo}/hooks/{hook_id}
     * Official operationId: repos/update-webhook
     * Docs: https://docs.github.com/rest/repos/webhooks#update-a-repository-webhook
     * Body: { config, events, add_events, remove_events, active }
     */
    async updateRepositoryWebhook(owner, repo, hookId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.repoHook(owner, repo, hookId),
            body: data,
        });
    }

    /**
     * Delete a repository webhook.
     * DELETE /repos/{owner}/{repo}/hooks/{hook_id}
     * Official operationId: repos/delete-webhook
     * Docs: https://docs.github.com/rest/repos/webhooks#delete-a-repository-webhook
     */
    async deleteRepositoryWebhook(owner, repo, hookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.repoHook(owner, repo, hookId),
        });
    }
}

module.exports = { Api };
