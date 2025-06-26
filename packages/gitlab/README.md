# GitLab API Module

A comprehensive Node.js module for integrating with GitLab's REST API v4, built for the Frigg Framework.

## Overview

This module provides seamless integration with GitLab (both GitLab.com and self-hosted instances), supporting version control, DevOps workflows, CI/CD pipelines, and project management. It handles OAuth2 authentication and provides methods for managing projects, issues, merge requests, groups, pipelines, and more.

## Installation

```bash
npm install @friggframework/api-module-gitlab
```

## Configuration

### Environment Variables

Set the following environment variables:

```bash
GITLAB_CLIENT_ID=your_gitlab_client_id
GITLAB_CLIENT_SECRET=your_gitlab_client_secret
GITLAB_SCOPE=read_user read_api write_repository
GITLAB_BASE_URL=https://gitlab.com  # Optional: Use for self-hosted instances
REDIRECT_URI=your_redirect_uri_base
```

### GitLab Application Setup

1. Go to your GitLab instance (e.g., https://gitlab.com/-/profile/applications)
2. Create a new application
3. Configure the redirect URI: `{REDIRECT_URI}/gitlab`
4. Set the required scopes:
   - `read_user` - Read user information
   - `read_api` - Read access to the API
   - `write_repository` - Write access to repositories
   - `read_repository` - Read access to repositories
   - `api` - Complete API access (includes all other scopes)

## Usage

### Basic Setup

```javascript
const { Api, Definition } = require('@friggframework/api-module-gitlab');

// Initialize the API
const api = new Api({
    client_id: process.env.GITLAB_CLIENT_ID,
    client_secret: process.env.GITLAB_CLIENT_SECRET,
    redirect_uri: `${process.env.REDIRECT_URI}/gitlab`,
    scope: 'read_user read_api write_repository',
    baseUrl: 'https://gitlab.com' // Use your GitLab instance URL
});
```

### Authentication Flow

```javascript
// 1. Get authorization URL
const authUrl = api.getAuthUri();
console.log('Visit this URL to authorize:', authUrl);

// 2. Handle the callback with authorization code
const tokens = await api.getTokenFromCode(authorizationCode);

// 3. Get current user details
const user = await api.getUserDetails();
console.log('Authenticated as:', user.name);
```

### Projects

```javascript
// List all projects accessible to the user
const projects = await api.listProjects({
    membership: true,
    order_by: 'last_activity_at',
    sort: 'desc'
});

// List user's own projects
const userProjects = await api.listUserProjects({
    owned: true
});

// Search for projects
const searchResults = await api.searchProjects('nodejs', {
    order_by: 'stars',
    sort: 'desc'
});

// Get a specific project
const project = await api.getProjectById(12345);

// Create a new project
const newProject = await api.createProject({
    name: 'My New Project',
    path: 'my-new-project',
    description: 'A project created via API',
    visibility: 'private',
    issues_enabled: true,
    merge_requests_enabled: true,
    wiki_enabled: true
});

// Update a project
await api.updateProject(12345, {
    description: 'Updated project description',
    visibility: 'internal'
});

// Delete a project
await api.deleteProject(12345);
```

### Issues

```javascript
// List all issues across projects
const allIssues = await api.listIssues({
    state: 'opened',
    assignee_id: 'me',
    order_by: 'created_at',
    sort: 'desc'
});

// List project-specific issues
const projectIssues = await api.listProjectIssues(12345, {
    state: 'opened',
    labels: 'bug,high-priority'
});

// Get a specific issue
const issue = await api.getIssueById(12345, 1);

// Create a new issue
const newIssue = await api.createIssue(12345, {
    title: 'Bug: Application crashes on startup',
    description: 'The application crashes when starting up on Windows 10',
    labels: ['bug', 'high-priority'],
    assignee_ids: [456],
    milestone_id: 7
});

// Update an issue
await api.updateIssue(12345, 1, {
    title: 'Updated issue title',
    description: 'Updated description',
    state_event: 'close'  // or 'reopen'
});

// Close an issue
await api.updateIssue(12345, 1, {
    state_event: 'close'
});
```

### Merge Requests

```javascript
// List all merge requests
const allMRs = await api.listMergeRequests({
    state: 'opened',
    author_id: 'me',
    order_by: 'created_at',
    sort: 'desc'
});

// List project merge requests
const projectMRs = await api.listProjectMergeRequests(12345, {
    state: 'opened',
    target_branch: 'main'
});

// Get a specific merge request
const mr = await api.getMergeRequestById(12345, 1);

// Create a new merge request
const newMR = await api.createMergeRequest(12345, {
    title: 'Feature: Add user authentication',
    description: 'This MR implements OAuth2 authentication for users',
    source_branch: 'feature/auth',
    target_branch: 'main',
    assignee_ids: [456],
    reviewer_ids: [789],
    labels: ['enhancement']
});

// Update a merge request
await api.updateMergeRequest(12345, 1, {
    title: 'Updated MR title',
    description: 'Updated description',
    target_branch: 'develop'
});

// Accept/merge a merge request
await api.acceptMergeRequest(12345, 1, {
    merge_commit_message: 'Merged feature branch',
    should_remove_source_branch: true,
    merge_when_pipeline_succeeds: true
});
```

### Groups

```javascript
// List all groups
const groups = await api.listGroups({
    owned: true,
    order_by: 'name',
    sort: 'asc'
});

// Get a specific group
const group = await api.getGroupById('my-group');

// Create a new group
const newGroup = await api.createGroup({
    name: 'Development Team',
    path: 'dev-team',
    description: 'Group for development team projects',
    visibility: 'private'
});

// List group projects
const groupProjects = await api.listGroupProjects('dev-team', {
    order_by: 'last_activity_at',
    sort: 'desc'
});

// Update a group
await api.updateGroup('dev-team', {
    description: 'Updated group description'
});
```

### CI/CD Pipelines

```javascript
// List project pipelines
const pipelines = await api.listProjectPipelines(12345, {
    status: 'success',
    ref: 'main',
    order_by: 'id',
    sort: 'desc'
});

// Get a specific pipeline
const pipeline = await api.getPipelineById(12345, 98765);

// Create a new pipeline
const newPipeline = await api.createPipeline(12345, {
    ref: 'main',
    variables: [
        { key: 'DEPLOY_ENV', value: 'staging' },
        { key: 'FORCE_DEPLOY', value: 'true' }
    ]
});

// Retry a failed pipeline
await api.retryPipeline(12345, 98765);

// Cancel a running pipeline
await api.cancelPipeline(12345, 98765);
```

### Repository Operations

```javascript
// List commits
const commits = await api.listProjectCommits(12345, {
    ref_name: 'main',
    since: '2023-01-01T00:00:00Z',
    until: '2023-12-31T23:59:59Z'
});

// Get a specific commit
const commit = await api.getCommitById(12345, 'abc123def456');

// List branches
const branches = await api.listProjectBranches(12345, {
    search: 'feature'
});

// Get a specific branch
const branch = await api.getBranchById(12345, 'feature/new-feature');

// Create a new branch
const newBranch = await api.createBranch(12345, {
    branch: 'feature/awesome-feature',
    ref: 'main'
});

// Delete a branch
await api.deleteBranch(12345, 'feature/old-feature');
```

### Milestones

```javascript
// List project milestones
const milestones = await api.listProjectMilestones(12345, {
    state: 'active'
});

// Create a milestone
const newMilestone = await api.createMilestone(12345, {
    title: 'Version 2.0',
    description: 'Major release with new features',
    due_date: '2024-06-01',
    start_date: '2024-01-01'
});

// Get a specific milestone
const milestone = await api.getMilestoneById(12345, 1);

// Update a milestone
await api.updateMilestone(12345, 1, {
    title: 'Version 2.0 - Updated',
    state_event: 'close'
});
```

### Labels

```javascript
// List project labels
const labels = await api.listProjectLabels(12345);

// Create a new label
const newLabel = await api.createLabel(12345, {
    name: 'high-priority',
    color: '#FF0000',
    description: 'High priority issues and merge requests'
});
```

### Webhooks

```javascript
// List project webhooks
const hooks = await api.listProjectHooks(12345);

// Create a webhook
const newWebhook = await api.createWebhook(12345, {
    url: 'https://myapp.com/webhook/gitlab',
    push_events: true,
    issues_events: true,
    merge_requests_events: true,
    tag_push_events: true,
    wiki_page_events: true,
    deployment_events: true,
    job_events: true,
    pipeline_events: true,
    token: 'secret-webhook-token'
});

// Update a webhook
await api.updateWebhook(12345, 1, {
    url: 'https://myapp.com/webhook/gitlab-updated',
    push_events: false,
    issues_events: true
});

// Delete a webhook
await api.deleteWebhook(12345, 1);
```

### Users

```javascript
// Search for users
const users = await api.getUsers({
    search: 'john',
    active: true
});

// Get a specific user
const user = await api.getUserById(456);

// Get current user details
const currentUser = await api.getUserDetails();
```

## Advanced Usage

### Error Handling

```javascript
try {
    const project = await api.getProjectById(999999);
} catch (error) {
    if (error.status === 404) {
        console.log('Project not found');
    } else if (error.status === 403) {
        console.log('Access denied to project');
    } else {
        console.error('API Error:', error);
    }
}
```

### Pagination

```javascript
// Handle large result sets with pagination
async function getAllProjects() {
    let allProjects = [];
    let page = 1;
    const perPage = 100;
    
    while (true) {
        const projects = await api.listProjects({
            page,
            per_page: perPage,
            membership: true
        });
        
        allProjects = allProjects.concat(projects);
        
        if (projects.length < perPage) {
            break;
        }
        
        page++;
    }
    
    return allProjects;
}
```

### Self-Hosted GitLab Instances

```javascript
// For self-hosted GitLab instances
const api = new Api({
    client_id: process.env.GITLAB_CLIENT_ID,
    client_secret: process.env.GITLAB_CLIENT_SECRET,
    redirect_uri: `${process.env.REDIRECT_URI}/gitlab`,
    scope: 'api',
    baseUrl: 'https://gitlab.mycompany.com' // Your GitLab instance URL
});
```

### Working with GitLab CI/CD Variables

```javascript
// When creating pipelines, you can pass variables
const pipeline = await api.createPipeline(12345, {
    ref: 'main',
    variables: [
        { key: 'ENVIRONMENT', value: 'production' },
        { key: 'DEPLOY_KEY', value: process.env.DEPLOY_KEY },
        { key: 'BUILD_NUMBER', value: Date.now().toString() }
    ]
});
```

## API Reference

### Core Methods

#### Authentication & Users
- `getAuthUri()` - Get OAuth authorization URL
- `getTokenFromCode(code)` - Exchange authorization code for tokens
- `getUserDetails()` - Get current user information
- `getUsers(params)` - Search for users
- `getUserById(userId)` - Get specific user details

#### Projects
- `listProjects(params)` - List accessible projects
- `listUserProjects(params)` - List user's own projects
- `searchProjects(term, params)` - Search projects
- `getProjectById(projectId)` - Get specific project
- `createProject(projectData)` - Create new project
- `updateProject(projectId, updates)` - Update project
- `deleteProject(projectId)` - Delete project

#### Issues
- `listIssues(params)` - List issues across projects
- `listProjectIssues(projectId, params)` - List project issues
- `getIssueById(projectId, issueId)` - Get specific issue
- `createIssue(projectId, issueData)` - Create new issue
- `updateIssue(projectId, issueId, updates)` - Update issue
- `deleteIssue(projectId, issueId)` - Delete issue

#### Merge Requests
- `listMergeRequests(params)` - List merge requests
- `listProjectMergeRequests(projectId, params)` - List project MRs
- `getMergeRequestById(projectId, mrId)` - Get specific MR
- `createMergeRequest(projectId, mrData)` - Create new MR
- `updateMergeRequest(projectId, mrId, updates)` - Update MR
- `acceptMergeRequest(projectId, mrId, options)` - Accept/merge MR

#### Groups
- `listGroups(params)` - List groups
- `getGroupById(groupId)` - Get specific group
- `createGroup(groupData)` - Create new group
- `updateGroup(groupId, updates)` - Update group
- `deleteGroup(groupId)` - Delete group
- `listGroupProjects(groupId, params)` - List group projects

#### CI/CD Pipelines
- `listProjectPipelines(projectId, params)` - List pipelines
- `getPipelineById(projectId, pipelineId)` - Get specific pipeline
- `createPipeline(projectId, options)` - Create new pipeline
- `retryPipeline(projectId, pipelineId)` - Retry pipeline
- `cancelPipeline(projectId, pipelineId)` - Cancel pipeline

#### Repository
- `listProjectCommits(projectId, params)` - List commits
- `getCommitById(projectId, commitId)` - Get specific commit
- `listProjectBranches(projectId, params)` - List branches
- `getBranchById(projectId, branchName)` - Get specific branch
- `createBranch(projectId, branchData)` - Create new branch
- `deleteBranch(projectId, branchName)` - Delete branch

#### Project Management
- `listProjectMilestones(projectId, params)` - List milestones
- `createMilestone(projectId, milestoneData)` - Create milestone
- `getMilestoneById(projectId, milestoneId)` - Get milestone
- `updateMilestone(projectId, milestoneId, updates)` - Update milestone
- `listProjectLabels(projectId, params)` - List labels
- `createLabel(projectId, labelData)` - Create label

#### Webhooks
- `listProjectHooks(projectId)` - List webhooks
- `createWebhook(projectId, webhookData)` - Create webhook
- `updateWebhook(projectId, hookId, updates)` - Update webhook
- `deleteWebhook(projectId, hookId)` - Delete webhook

## Resources

- [GitLab REST API Documentation](https://docs.gitlab.com/ee/api/)
- [GitLab OAuth2 Guide](https://docs.gitlab.com/ee/api/oauth2.html)
- [GitLab Webhooks Documentation](https://docs.gitlab.com/ee/user/project/integrations/webhooks.html)
- [GitLab CI/CD API Documentation](https://docs.gitlab.com/ee/api/pipelines.html)

## License

MIT License - see LICENSE file for details.