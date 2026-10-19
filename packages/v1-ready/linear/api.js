const {get, OAuth2Requester} = require('@friggframework/core');
const {LinearClient} = require('@linear/sdk');

const crypto = require('crypto');

// ---- webhook signature helpers (used by verifyWebhookSignature) ------------
function whHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    const want = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === want) {
            const v = headers[key];
            return Array.isArray(v) ? v[0] : v;
        }
    }
    return undefined;
}

/** The bytes the vendor signed: rawBody when given, else the body (JSON-stringified if parsed). */
function whPayload(rawBody, body) {
    if (rawBody !== undefined && rawBody !== null) {
        return Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
    }
    if (body === undefined || body === null) return Buffer.alloc(0);
    if (Buffer.isBuffer(body)) return body;
    if (typeof body === 'string') return Buffer.from(body, 'utf8');
    return Buffer.from(JSON.stringify(body), 'utf8');
}

/** Constant-time string comparison; false (not a throw) when the lengths differ. */
function whSafeEqual(a, b) {
    const x = Buffer.from(String(a), 'utf8');
    const y = Buffer.from(String(b), 'utf8');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function whNowMs(now) {
    if (now instanceof Date) return now.getTime();
    return typeof now === 'number' ? now : Date.now();
}

function whHmac(key, parts, encoding) {
    const h = crypto.createHmac('sha256', key);
    for (const p of parts) h.update(p);
    return h.digest(encoding);
}

// ---- GraphQL documents -------------------------------------------------------
// Sent through the SDK's LinearGraphQLClient (client.client.rawRequest), so the request
// is the documented GraphQL operation rather than whatever an SDK helper builds.
// Schema: https://github.com/linear/linear/blob/master/packages/sdk/src/schema.graphql
const ISSUE_FIELDS = `
    id
    identifier
    title
    description
    priority
    url
    createdAt
    updatedAt
    state { id name type }
    team { id key }
    assignee { id email }
    labels { nodes { id name } }
    attachments { nodes { id url title } }
`;

const ISSUE_QUERY = `query Issue($id: String!) { issue(id: $id) {${ISSUE_FIELDS}} }`;

const ISSUES_QUERY = `query Issues($filter: IssueFilter, $first: Int) {
  issues(filter: $filter, first: $first) { nodes {${ISSUE_FIELDS}} pageInfo { hasNextPage endCursor } }
}`;

const ISSUE_CREATE_MUTATION = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) { success issue {${ISSUE_FIELDS}} }
}`;

const ISSUE_UPDATE_MUTATION = `mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) { success issue {${ISSUE_FIELDS}} }
}`;

const COMMENT_CREATE_MUTATION = `mutation CommentCreate($input: CommentCreateInput!) {
  commentCreate(input: $input) { success comment { id body url createdAt issue { id identifier } } }
}`;

const ATTACHMENT_LINK_URL_MUTATION = `mutation AttachmentLinkURL($issueId: String!, $url: String!, $title: String) {
  attachmentLinkURL(issueId: $issueId, url: $url, title: $title) { success attachment { id title url } }
}`;

const TEAMS_QUERY = `query Teams($first: Int, $after: String) {
  teams(first: $first, after: $after) { nodes { id key name } pageInfo { hasNextPage endCursor } }
}`;

const WORKFLOW_STATES_QUERY = `query WorkflowStates($filter: WorkflowStateFilter, $first: Int, $after: String) {
  workflowStates(filter: $filter, first: $first, after: $after) {
    nodes { id name type position team { id key } }
    pageInfo { hasNextPage endCursor }
  }
}`;

const ISSUE_IDENTIFIER = /^[A-Za-z0-9]+-\d+$/;

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.webhookSecret = (params && params.webhookSecret) || null;
        this.actor = get(params, 'actor', 'application');
        this.access_token = get(params, 'access_token', null);
        this.authorizationUri = encodeURI(
            `https://linear.app/oauth/authorize?response_type=code` +
            `&scope=${this.scope}` +
            `&client_id=${this.client_id}` +
            `&redirect_uri=${this.redirect_uri}` +
            `&state=${this.state}` +
            `&actor=${this.actor}`
        );
        this.tokenUri = 'https://api.linear.app/oauth/token';
    }

    getClient() {
        if (!this.client) {
            this.client = new LinearClient({accessToken: this.access_token});
        }
        return this.client;
    }


    async getTokenIdentity() {
        const user = await this.getUser();
        const org = await this.getOrganization();
        return {identifier: org.id, name: user.name};
    }

    async getUser() {
        return this.getClient().viewer;
    }

    async getOrganization() {
        return this.getClient().organization;
    }

    async getUsers() {
        return (await this.getClient().users()).nodes;
    }

    async getUserIssues(user) {
        return user.assignedIssues();
    }

    async getProjects() {
        return (await this.getClient().projects()).nodes;
    }


    /** Send one GraphQL operation and return its `data`. Throws on GraphQL/transport errors. */
    async graphql(query, variables) {
        const response = await this.getClient().client.rawRequest(query, variables);
        return response.data;
    }

    /** Mutation payloads carry `success`; a false one must not be reported as a result. */
    _assertSuccess(payload, name) {
        if (!payload || payload.success !== true) {
            throw new Error(`Linear ${name} did not succeed`);
        }
        return payload;
    }

    /**
     * Get one issue by id. Linear accepts the UUID or the identifier ("ENG-142").
     * Docs: https://linear.app/developers/graphql
     * @param {string} id
     */
    async issue(id) {
        if (!id) throw new Error('issue: id is required');
        return (await this.graphql(ISSUE_QUERY, {id})).issue;
    }

    /**
     * Get one issue by its human identifier ("ENG-142").
     * Docs: https://linear.app/developers/graphql (`issue(id: "BLA-123")`)
     * @param {string} identifier
     */
    async issueByIdentifier(identifier) {
        if (!ISSUE_IDENTIFIER.test(String(identifier || ''))) {
            throw new Error('issueByIdentifier: identifier must look like "ENG-142"');
        }
        return (await this.graphql(ISSUE_QUERY, {id: identifier})).issue;
    }

    /**
     * Search issues with Linear's `IssueFilter` (query `issues`). Returns the nodes only.
     * Docs: https://linear.app/developers/filtering
     * @param {string} [teamId] team UUID
     * @param {string} [stateType] triage|backlog|unstarted|started|completed|canceled
     * @param {string} [updatedBefore] ISO date-time; issues updated strictly before it
     * @param {number} [first] page size (Linear's default is 50)
     */
    async searchIssues(teamId, stateType, updatedBefore, first) {
        const filter = {};
        if (teamId) filter.team = {id: {eq: teamId}};
        if (stateType) filter.state = {type: {eq: stateType}};
        if (updatedBefore) filter.updatedAt = {lt: updatedBefore};
        const variables = {filter};
        if (first !== undefined && first !== null) variables.first = first;
        return (await this.graphql(ISSUES_QUERY, variables)).issues.nodes;
    }

    /**
     * Create an issue (mutation `issueCreate`). `stateName` is resolved to a workflow state id
     * within the team first, because IssueCreateInput only takes `stateId`.
     * Docs: https://linear.app/developers/graphql#creating-and-editing-issues
     * @param {string} teamId
     * @param {string} title
     * @param {string} [description] markdown
     * @param {number} [priority] 0 none, 1 urgent, 2 high, 3 medium, 4 low
     * @param {string} [stateName] workflow state name within the team
     * @param {string[]} [labelIds]
     */
    async issueCreate(teamId, title, description, priority, stateName, labelIds) {
        if (!teamId) throw new Error('issueCreate: teamId is required');
        if (!title) throw new Error('issueCreate: title is required');
        const input = {teamId, title};
        if (description !== undefined) input.description = description;
        if (priority !== undefined) input.priority = priority;
        if (labelIds !== undefined) input.labelIds = labelIds;
        if (stateName) {
            const states = await this.workflowStates(teamId, stateName);
            if (!states.length) {
                throw new Error(`issueCreate: no workflow state named "${stateName}" on team ${teamId}`);
            }
            input.stateId = states[0].id;
        }
        const data = await this.graphql(ISSUE_CREATE_MUTATION, {input});
        return this._assertSuccess(data.issueCreate, 'issueCreate').issue;
    }

    /**
     * Update an issue (mutation `issueUpdate`). `id` may be the UUID or the identifier.
     * Docs: https://linear.app/developers/graphql#creating-and-editing-issues
     * @param {string} id
     * @param {object} input IssueUpdateInput, e.g. {title, description, priority, stateId, labelIds}
     */
    async issueUpdate(id, input) {
        if (!id) throw new Error('issueUpdate: id is required');
        if (!input || typeof input !== 'object') throw new Error('issueUpdate: input is required');
        const data = await this.graphql(ISSUE_UPDATE_MUTATION, {id, input});
        return this._assertSuccess(data.issueUpdate, 'issueUpdate').issue;
    }

    /**
     * Comment on an issue (mutation `commentCreate`).
     * Docs: https://linear.app/developers/graphql
     * @param {string} issueId UUID
     * @param {string} body markdown
     */
    async commentCreate(issueId, body) {
        if (!issueId) throw new Error('commentCreate: issueId is required');
        if (!body) throw new Error('commentCreate: body is required');
        const data = await this.graphql(COMMENT_CREATE_MUTATION, {input: {issueId, body}});
        return this._assertSuccess(data.commentCreate, 'commentCreate').comment;
    }

    /**
     * Link a URL to an issue (mutation `attachmentLinkURL`); issueId may be a UUID or "ENG-142".
     * Docs: https://linear.app/developers/attachments
     * @param {string} issueId
     * @param {string} url
     * @param {string} [title]
     */
    async attachmentLinkURL(issueId, url, title) {
        if (!issueId) throw new Error('attachmentLinkURL: issueId is required');
        if (!url) throw new Error('attachmentLinkURL: url is required');
        const variables = {issueId, url};
        if (title !== undefined) variables.title = title;
        const data = await this.graphql(ATTACHMENT_LINK_URL_MUTATION, variables);
        return this._assertSuccess(data.attachmentLinkURL, 'attachmentLinkURL').attachment;
    }

    /**
     * List every team in the workspace (follows pagination, 100 per page).
     * Docs: https://linear.app/developers/pagination
     */
    async teams() {
        const nodes = [];
        let after;
        for (;;) {
            const variables = {first: 100};
            if (after) variables.after = after;
            const {teams} = await this.graphql(TEAMS_QUERY, variables);
            nodes.push(...teams.nodes);
            if (!teams.pageInfo.hasNextPage) return nodes;
            after = teams.pageInfo.endCursor;
        }
    }

    /**
     * List a team's workflow states (follows pagination, 100 per page).
     * Docs: https://linear.app/developers/graphql (query `workflowStates`, filter `WorkflowStateFilter`)
     * @param {string} teamId
     * @param {string} [name] only states with exactly this name
     */
    async workflowStates(teamId, name) {
        if (!teamId) throw new Error('workflowStates: teamId is required');
        const filter = {team: {id: {eq: teamId}}};
        if (name) filter.name = {eq: name};
        const nodes = [];
        let after;
        for (;;) {
            const variables = {filter, first: 100};
            if (after) variables.after = after;
            const {workflowStates} = await this.graphql(WORKFLOW_STATES_QUERY, variables);
            nodes.push(...workflowStates.nodes);
            if (!workflowStates.pageInfo.hasNextPage) return nodes;
            after = workflowStates.pageInfo.endCursor;
        }
    }

    /**
     * Verify a Linear webhook delivery (Linear-Signature).
     * Docs: https://linear.app/developers/webhooks
     *
     * Hex HMAC-SHA256 of the raw body keyed with the webhook's signing secret, plus the body's
     * `webhookTimestamp` (ms) must be within 60 seconds of now. Pass `rawBody`.
     * Never throws; returns true only for a genuine delivery.
     */
    async verifyWebhookSignature({ headers, body, rawBody, now } = {}) {
        try {
            const secret = this.webhookSecret || process.env.LINEAR_WEBHOOK_SECRET;
            if (!secret) return false;
            const signature = whHeader(headers, 'linear-signature');
            if (!signature) return false;
            const payload = whPayload(rawBody, body);
            const expected = whHmac(secret, [payload], 'hex');
            if (!whSafeEqual(expected, String(signature).trim().toLowerCase())) {
                return false;
            }
            let parsed = body;
            if (rawBody !== undefined && rawBody !== null) {
                parsed = JSON.parse(payload.toString('utf8'));
            } else if (typeof body === 'string') {
                parsed = JSON.parse(body);
            }
            const ts = Number(parsed && parsed.webhookTimestamp);
            if (!Number.isFinite(ts)) return false;
            return Math.abs(whNowMs(now) - ts) <= 60 * 1000;
        } catch (e) {
            return false;
        }
    }
}

module.exports = {Api};
