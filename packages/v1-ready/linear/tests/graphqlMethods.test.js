const mockRawRequest = jest.fn();
jest.mock('@linear/sdk', () => ({ LinearClient: jest.fn(() => ({ client: { rawRequest: mockRawRequest } })) }), { virtual: true });
const { LinearClient } = require('@linear/sdk');
const { Api } = require('../api');

const ok = (data) => mockRawRequest.mockResolvedValueOnce({ data, status: 200, headers: {} });
const sent = (i = 0) => ({ query: mockRawRequest.mock.calls[i][0], variables: mockRawRequest.mock.calls[i][1] });
const squash = (q) => q.replace(/\s+/g, ' ');

describe('Linear GraphQL methods (asserting the outbound request)', () => {
    let api;
    beforeEach(() => {
        mockRawRequest.mockReset();
        LinearClient.mockClear();
        api = new Api({ access_token: 'tok' });
    });

    it('authenticates the SDK client with the access token', async () => {
        ok({ issue: { id: 'i1' } });
        await api.issue('i1');
        expect(LinearClient).toHaveBeenCalledWith({ accessToken: 'tok' });
    });

    describe('issue', () => {
        it('sends the issue query with the id', async () => {
            ok({ issue: { id: 'uuid-1', title: 'T' } });
            const result = await api.issue('uuid-1');
            const { query, variables } = sent();
            expect(squash(query)).toMatch(/^query Issue\(\$id: String!\) \{ issue\(id: \$id\)/);
            expect(query).toContain('identifier');
            expect(variables).toEqual({ id: 'uuid-1' });
            expect(result).toEqual({ id: 'uuid-1', title: 'T' });
        });
        it('refuses a missing id without a request', async () => {
            await expect(api.issue()).rejects.toThrow(/id is required/);
            expect(mockRawRequest).not.toHaveBeenCalled();
        });
    });

    describe('issueByIdentifier', () => {
        it('sends the identifier as the issue id', async () => {
            ok({ issue: { identifier: 'ENG-142' } });
            await api.issueByIdentifier('ENG-142');
            expect(squash(sent().query)).toContain('issue(id: $id)');
            expect(sent().variables).toEqual({ id: 'ENG-142' });
        });
        it('rejects something that is not an identifier, with no request', async () => {
            await expect(api.issueByIdentifier('not an id')).rejects.toThrow(/ENG-142/);
            expect(mockRawRequest).not.toHaveBeenCalled();
        });
    });

    describe('searchIssues', () => {
        it('builds team / state type / updatedAt filters and first', async () => {
            ok({ issues: { nodes: [{ id: 'a' }], pageInfo: {} } });
            const nodes = await api.searchIssues('team-1', 'started', '2026-10-01T00:00:00.000Z', 25);
            const { query, variables } = sent();
            expect(squash(query)).toContain('issues(filter: $filter, first: $first)');
            expect(variables).toEqual({
                filter: {
                    team: { id: { eq: 'team-1' } },
                    state: { type: { eq: 'started' } },
                    updatedAt: { lt: '2026-10-01T00:00:00.000Z' },
                },
                first: 25,
            });
            expect(nodes).toEqual([{ id: 'a' }]);
        });
        it('sends an empty filter and no first when nothing is given', async () => {
            ok({ issues: { nodes: [], pageInfo: {} } });
            await api.searchIssues();
            expect(sent().variables).toEqual({ filter: {} });
        });
    });

    describe('issueCreate', () => {
        it('sends IssueCreateInput with only the given fields', async () => {
            ok({ issueCreate: { success: true, issue: { id: 'n1' } } });
            const issue = await api.issueCreate('team-1', 'Title', 'desc', 2, undefined, ['l1']);
            expect(mockRawRequest).toHaveBeenCalledTimes(1);
            const { query, variables } = sent();
            expect(squash(query)).toContain('mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input)');
            expect(variables).toEqual({
                input: { teamId: 'team-1', title: 'Title', description: 'desc', priority: 2, labelIds: ['l1'] },
            });
            expect(issue).toEqual({ id: 'n1' });
        });
        it('resolves stateName to stateId with a team+name filtered lookup first', async () => {
            ok({ workflowStates: { nodes: [{ id: 'state-9', name: 'In Progress' }], pageInfo: { hasNextPage: false } } });
            ok({ issueCreate: { success: true, issue: { id: 'n1' } } });
            await api.issueCreate('team-1', 'Title', undefined, undefined, 'In Progress');
            expect(sent(0).variables).toEqual({
                filter: { team: { id: { eq: 'team-1' } }, name: { eq: 'In Progress' } },
                first: 100,
            });
            expect(sent(1).variables).toEqual({ input: { teamId: 'team-1', title: 'Title', stateId: 'state-9' } });
        });
        it('fails before creating when the state name does not exist', async () => {
            ok({ workflowStates: { nodes: [], pageInfo: { hasNextPage: false } } });
            await expect(api.issueCreate('team-1', 'T', undefined, undefined, 'Nope')).rejects.toThrow(/no workflow state/);
            expect(mockRawRequest).toHaveBeenCalledTimes(1);
        });
        it('throws when Linear reports success: false', async () => {
            ok({ issueCreate: { success: false, issue: null } });
            await expect(api.issueCreate('team-1', 'T')).rejects.toThrow(/did not succeed/);
        });
        it('requires teamId and title', async () => {
            await expect(api.issueCreate(undefined, 'T')).rejects.toThrow(/teamId/);
            await expect(api.issueCreate('t')).rejects.toThrow(/title/);
        });
    });

    describe('issueUpdate', () => {
        it('sends id and the input object unchanged', async () => {
            ok({ issueUpdate: { success: true, issue: { id: 'i1' } } });
            await api.issueUpdate('i1', { title: 'New', stateId: 's1', priority: 1 });
            const { query, variables } = sent();
            expect(squash(query)).toContain('mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input)');
            expect(variables).toEqual({ id: 'i1', input: { title: 'New', stateId: 's1', priority: 1 } });
        });
        it('throws on success: false and on missing input', async () => {
            ok({ issueUpdate: { success: false } });
            await expect(api.issueUpdate('i1', { title: 'x' })).rejects.toThrow(/did not succeed/);
            await expect(api.issueUpdate('i1')).rejects.toThrow(/input is required/);
        });
    });

    describe('commentCreate', () => {
        it('sends CommentCreateInput with issueId and body', async () => {
            ok({ commentCreate: { success: true, comment: { id: 'c1' } } });
            const comment = await api.commentCreate('issue-1', 'hello **world**');
            const { query, variables } = sent();
            expect(squash(query)).toContain('mutation CommentCreate($input: CommentCreateInput!) { commentCreate(input: $input)');
            expect(variables).toEqual({ input: { issueId: 'issue-1', body: 'hello **world**' } });
            expect(comment).toEqual({ id: 'c1' });
        });
    });

    describe('attachmentLinkURL', () => {
        it('sends issueId, url and title', async () => {
            ok({ attachmentLinkURL: { success: true, attachment: { id: 'a1' } } });
            const att = await api.attachmentLinkURL('ENG-1', 'https://example.com/x', 'Example');
            const { query, variables } = sent();
            expect(squash(query)).toContain('attachmentLinkURL(issueId: $issueId, url: $url, title: $title)');
            expect(variables).toEqual({ issueId: 'ENG-1', url: 'https://example.com/x', title: 'Example' });
            expect(att).toEqual({ id: 'a1' });
        });
        it('omits title when not given', async () => {
            ok({ attachmentLinkURL: { success: true, attachment: {} } });
            await api.attachmentLinkURL('ENG-1', 'https://example.com/x');
            expect(sent().variables).toEqual({ issueId: 'ENG-1', url: 'https://example.com/x' });
        });
    });

    describe('teams', () => {
        it('queries teams and follows pagination cursors', async () => {
            ok({ teams: { nodes: [{ id: 't1' }], pageInfo: { hasNextPage: true, endCursor: 'c1' } } });
            ok({ teams: { nodes: [{ id: 't2' }], pageInfo: { hasNextPage: false, endCursor: 'c2' } } });
            const teams = await api.teams();
            expect(squash(sent(0).query)).toContain('teams(first: $first, after: $after)');
            expect(sent(0).variables).toEqual({ first: 100 });
            expect(sent(1).variables).toEqual({ first: 100, after: 'c1' });
            expect(teams).toEqual([{ id: 't1' }, { id: 't2' }]);
        });
    });

    describe('workflowStates', () => {
        it('filters by team id and follows pagination', async () => {
            ok({ workflowStates: { nodes: [{ id: 's1' }], pageInfo: { hasNextPage: true, endCursor: 'k' } } });
            ok({ workflowStates: { nodes: [{ id: 's2' }], pageInfo: { hasNextPage: false } } });
            const states = await api.workflowStates('team-1');
            expect(squash(sent(0).query)).toContain('workflowStates(filter: $filter, first: $first, after: $after)');
            expect(sent(0).variables).toEqual({ filter: { team: { id: { eq: 'team-1' } } }, first: 100 });
            expect(sent(1).variables).toEqual({ filter: { team: { id: { eq: 'team-1' } } }, first: 100, after: 'k' });
            expect(states.map((s) => s.id)).toEqual(['s1', 's2']);
        });
        it('requires teamId', async () => {
            await expect(api.workflowStates()).rejects.toThrow(/teamId/);
        });
    });
});
