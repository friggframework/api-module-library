# Jira API Module

A comprehensive Node.js module for integrating with Jira's REST API v3, built for the Frigg Framework.

## Overview

This module provides seamless integration with Jira Cloud, supporting project management, issue tracking, and agile development workflows. It handles OAuth2 authentication and provides methods for managing projects, issues, users, and dashboards.

## Installation

```bash
npm install @friggframework/api-module-jira
```

## Configuration

### Environment Variables

Set the following environment variables:

```bash
JIRA_CLIENT_ID=your_jira_client_id
JIRA_CLIENT_SECRET=your_jira_client_secret
JIRA_SCOPE=read:jira-user read:jira-work write:jira-work manage:jira-project manage:jira-configuration
REDIRECT_URI=your_redirect_uri_base
```

### Jira App Setup

1. Go to the [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/)
2. Create a new app or select an existing one
3. Add OAuth 2.0 (3LO) authorization
4. Configure the callback URL: `{REDIRECT_URI}/jira`
5. Set the required scopes:
   - `read:jira-user` - Read user information
   - `read:jira-work` - Read issues, projects, and other work items
   - `write:jira-work` - Create and update issues, comments, and attachments
   - `manage:jira-project` - Manage project settings and configurations
   - `manage:jira-configuration` - Manage global configuration settings

## Usage

### Basic Setup

```javascript
const { Api, Definition } = require('@friggframework/api-module-jira');

// Initialize the API
const api = new Api({
    client_id: process.env.JIRA_CLIENT_ID,
    client_secret: process.env.JIRA_CLIENT_SECRET,
    redirect_uri: `${process.env.REDIRECT_URI}/jira`,
    scope: 'read:jira-user read:jira-work write:jira-work'
});
```

### Authentication Flow

```javascript
// 1. Get authorization URL
const authUrl = api.getAuthUri();
console.log('Visit this URL to authorize:', authUrl);

// 2. Handle the callback with authorization code
const tokens = await api.getTokenFromCode(authorizationCode);

// 3. Set the cloud ID for your Jira instance
const resources = await api.getAccessibleResources();
api.setCloudId(resources[0].id);
```

### Projects

```javascript
// List all projects
const projects = await api.listProjects();

// Search projects with filters
const searchResults = await api.searchProjects({
    query: 'Software',
    typeKey: 'software'
});

// Get a specific project
const project = await api.getProjectById('PROJ');

// Create a new project
const newProject = await api.createProject({
    key: 'NEWPROJ',
    name: 'New Project',
    projectTypeKey: 'software',
    projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-agility-kanban',
    description: 'A new software project',
    leadAccountId: 'user-account-id'
});

// Update a project
await api.updateProject('PROJ', {
    name: 'Updated Project Name',
    description: 'Updated description'
});
```

### Issues

```javascript
// Search issues using JQL
const issues = await api.searchIssues('project = PROJ AND status = "To Do"', {
    maxResults: 50,
    startAt: 0,
    fields: ['summary', 'status', 'assignee']
});

// Get a specific issue
const issue = await api.getIssueById('PROJ-123', {
    fields: ['*all']
});

// Create a new issue
const newIssue = await api.createIssue({
    fields: {
        project: { key: 'PROJ' },
        summary: 'New task to complete',
        description: 'Detailed description of the task',
        issuetype: { name: 'Task' },
        priority: { name: 'Medium' },
        assignee: { accountId: 'user-account-id' }
    }
});

// Update an issue
await api.updateIssue('PROJ-123', {
    fields: {
        summary: 'Updated task summary',
        description: 'Updated description'
    }
});

// Transition an issue (change status)
const transitions = await api.getIssueTransitions('PROJ-123');
await api.transitionIssue('PROJ-123', {
    transition: { id: transitions.transitions[0].id }
});

// Add a comment to an issue
await api.addCommentToIssue('PROJ-123', {
    type: 'doc',
    version: 1,
    content: [{
        type: 'paragraph',
        content: [{
            type: 'text',
            text: 'This is a comment on the issue.'
        }]
    }]
});

// Get issue comments
const comments = await api.getIssueComments('PROJ-123');
```

### Users

```javascript
// Search for users
const users = await api.searchUsers({
    query: 'john.doe@example.com',
    includeInactive: false
});

// Get user details
const user = await api.getUserById('user-account-id');

// Get current user details
const currentUser = await api.getUserDetails();
```

### Dashboards

```javascript
// List dashboards
const dashboards = await api.listDashboards({
    filter: 'my',
    startAt: 0,
    maxResults: 20
});

// Get specific dashboard
const dashboard = await api.getDashboardById('12345');
```

### Metadata

```javascript
// Get available issue types
const issueTypes = await api.getIssueTypes();

// Get priorities
const priorities = await api.getPriorities();

// Get statuses
const statuses = await api.getStatuses();
```

## Advanced Usage

### Error Handling

```javascript
try {
    const issue = await api.getIssueById('INVALID-123');
} catch (error) {
    if (error.status === 404) {
        console.log('Issue not found');
    } else if (error.status === 403) {
        console.log('Access denied');
    } else {
        console.error('API Error:', error);
    }
}
```

### Pagination

```javascript
// Handle large result sets with pagination
async function getAllIssues(jql) {
    let allIssues = [];
    let startAt = 0;
    const maxResults = 100;
    
    while (true) {
        const response = await api.searchIssues(jql, {
            startAt,
            maxResults,
            fields: ['summary', 'status', 'assignee']
        });
        
        allIssues = allIssues.concat(response.issues);
        
        if (response.issues.length < maxResults) {
            break;
        }
        
        startAt += maxResults;
    }
    
    return allIssues;
}
```

### Custom Fields

```javascript
// Working with custom fields (use field IDs)
const issue = await api.createIssue({
    fields: {
        project: { key: 'PROJ' },
        summary: 'Task with custom fields',
        issuetype: { name: 'Task' },
        // Custom field example (field ID varies per instance)
        'customfield_10001': 'Custom field value',
        'customfield_10002': {
            value: 'Option 1'
        }
    }
});
```

## JQL (Jira Query Language) Examples

```javascript
// Basic JQL queries
const queries = [
    'project = PROJ',
    'assignee = currentUser()',
    'status = "In Progress"',
    'created >= -7d',
    'project = PROJ AND status IN ("To Do", "In Progress")',
    'text ~ "bug" AND priority = High',
    'assignee = currentUser() AND resolution = Unresolved ORDER BY priority DESC'
];

for (const jql of queries) {
    const results = await api.searchIssues(jql);
    console.log(`Query: ${jql} - Found: ${results.total} issues`);
}
```

## API Reference

### Core Methods

#### Authentication
- `getAuthUri()` - Get OAuth authorization URL
- `getTokenFromCode(code)` - Exchange authorization code for tokens
- `getAccessibleResources()` - Get available Jira instances
- `getUserDetails()` - Get current user information

#### Projects
- `listProjects(params)` - List all projects
- `searchProjects(params)` - Search projects with filters
- `getProjectById(projectId)` - Get specific project
- `createProject(projectData)` - Create new project
- `updateProject(projectId, updates)` - Update project
- `deleteProject(projectId)` - Delete project

#### Issues
- `searchIssues(jql, params)` - Search issues using JQL
- `getIssueById(issueId, params)` - Get specific issue
- `createIssue(issueData)` - Create new issue
- `updateIssue(issueId, updates)` - Update issue
- `deleteIssue(issueId)` - Delete issue
- `getIssueTransitions(issueId)` - Get available transitions
- `transitionIssue(issueId, transition)` - Change issue status
- `addCommentToIssue(issueId, comment)` - Add comment
- `getIssueComments(issueId, params)` - Get issue comments

#### Users
- `searchUsers(params)` - Search for users
- `getUserById(accountId)` - Get specific user

#### Dashboards
- `listDashboards(params)` - List dashboards
- `getDashboardById(dashboardId)` - Get specific dashboard

#### Metadata
- `getIssueTypes()` - Get available issue types
- `getPriorities()` - Get priority levels
- `getStatuses()` - Get status options

## Resources

- [Jira REST API Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Atlassian OAuth 2.0 Guide](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)
- [JQL Reference](https://support.atlassian.com/jira-service-management-cloud/docs/use-advanced-search-with-jira-query-language-jql/)
- [Jira Cloud Platform Documentation](https://developer.atlassian.com/cloud/jira/platform/)

## License

MIT License - see LICENSE file for details.