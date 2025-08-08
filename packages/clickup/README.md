# ClickUp API Module

A comprehensive Node.js module for integrating with ClickUp's API v2, built for the Frigg Framework.

## Overview

This module provides seamless integration with ClickUp, supporting project management, task tracking, team collaboration, and productivity workflows. It handles OAuth2 authentication and provides methods for managing teams, spaces, folders, lists, tasks, and more.

## Installation

```bash
npm install @friggframework/api-module-clickup
```

## Configuration

### Environment Variables

```bash
CLICKUP_CLIENT_ID=your_clickup_client_id
CLICKUP_CLIENT_SECRET=your_clickup_client_secret
REDIRECT_URI=your_redirect_uri_base
```

### ClickUp App Setup

1. Go to [ClickUp App Center](https://app.clickup.com/api)
2. Create a new app
3. Configure the redirect URI: `{REDIRECT_URI}/clickup`
4. No specific scopes needed - OAuth2 provides full API access

## Usage

### Basic Setup

```javascript
const { Api, Definition } = require('@friggframework/api-module-clickup');

const api = new Api({
    client_id: process.env.CLICKUP_CLIENT_ID,
    client_secret: process.env.CLICKUP_CLIENT_SECRET,
    redirect_uri: `${process.env.REDIRECT_URI}/clickup`
});
```

### Authentication Flow

```javascript
// 1. Get authorization URL
const authUrl = api.getAuthUri();

// 2. Handle callback
const tokens = await api.getTokenFromCode(authorizationCode);

// 3. Get user details
const user = await api.getUserDetails();
```

### Teams and Workspaces

```javascript
// Get authorized teams
const teams = await api.getAuthorizedTeams();

// Get specific team
const team = await api.getTeamById('team_id');

// Get team members  
const members = await api.getTeamMembers('team_id');
```

### Spaces

```javascript
// Get team spaces
const spaces = await api.getTeamSpaces('team_id');

// Create new space
const newSpace = await api.createSpace('team_id', {
    name: 'Development Projects',
    multiple_assignees: true,
    features: {
        due_dates: { enabled: true },
        time_tracking: { enabled: true }
    }
});

// Update space
await api.updateSpace('space_id', {
    name: 'Updated Space Name'
});
```

### Tasks

```javascript
// Get list tasks
const tasks = await api.getListTasks('list_id', {
    archived: false,
    include_closed: false
});

// Create task
const newTask = await api.createTask('list_id', {
    name: 'Implement user authentication',
    description: 'Add OAuth2 authentication to the application',
    assignees: [123456],
    status: 'to do',
    priority: 3,
    due_date: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days from now
});

// Update task
await api.updateTask('task_id', {
    name: 'Updated task name',
    status: 'in progress'
});
```

## API Reference

### Core Methods

#### Authentication & Users
- `getUserDetails()` - Get current user information
- `getAuthorizedTeams()` - Get user's teams

#### Teams/Workspaces  
- `getTeamById(teamId)` - Get specific team
- `getTeamMembers(teamId)` - Get team members

#### Spaces
- `getTeamSpaces(teamId, params)` - Get team spaces
- `createSpace(teamId, spaceData)` - Create new space
- `getSpaceById(spaceId)` - Get specific space
- `updateSpace(spaceId, updates)` - Update space
- `deleteSpace(spaceId)` - Delete space

#### Tasks
- `getListTasks(listId, params)` - Get list tasks
- `getTeamTasks(teamId, params)` - Get team tasks
- `createTask(listId, taskData)` - Create new task
- `getTaskById(taskId, params)` - Get specific task
- `updateTask(taskId, updates)` - Update task
- `deleteTask(taskId)` - Delete task

## Resources

- [ClickUp API Documentation](https://clickup.com/api)
- [ClickUp OAuth Guide](https://clickup.com/api/developer-portal/authentication/)

## License

MIT License - see LICENSE file for details.