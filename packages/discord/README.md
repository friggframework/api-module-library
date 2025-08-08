# Discord API Module

A comprehensive Discord API integration module for the Frigg Framework.

## Setup

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_SCOPE=identify email guilds
REDIRECT_URI=your_redirect_uri_base
```

### Getting Discord API Credentials

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select an existing one
3. Navigate to the OAuth2 section
4. Copy your Client ID and Client Secret
5. Add your redirect URI (e.g., `https://yourdomain.com/discord`)

### Required OAuth2 Scopes

- `identify` - Access to user's basic profile information
- `email` - Access to user's email address
- `guilds` - Access to user's guilds (servers)

Additional available scopes:
- `guilds.join` - Join guilds on behalf of the user
- `gdm.read` - Read group DMs
- `connections` - Access to user's connections
- `bot` - Add bot to guilds (requires bot permissions)

## Usage

```javascript
const { Api } = require('@friggframework/api-module-discord');

// Initialize with credentials
const discordApi = new Api({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URI + '/discord',
    scope: 'identify email guilds'
});

// Get authorization URL
const authUrl = discordApi.getAuthUri();

// Exchange code for tokens
const tokens = await discordApi.getTokenFromCode(authorizationCode);

// Use the API
const user = await discordApi.getCurrentUser();
const guilds = await discordApi.getCurrentUserGuilds();
```

## Available Methods

### User Methods
- `getCurrentUser()` - Get current user information
- `getCurrentUserGuilds()` - Get guilds the user is a member of
- `getCurrentUserConnections()` - Get user's connections (if scope granted)

### Guild Methods
- `getGuild(guildId)` - Get guild information
- `getGuildChannels(guildId)` - Get guild channels
- `getGuildMembers(guildId, options)` - Get guild members
- `getGuildRoles(guildId)` - Get guild roles

### Channel Methods
- `getChannel(channelId)` - Get channel information
- `getChannelMessages(channelId, options)` - Get channel messages
- `createMessage(channelId, content, options)` - Send a message
- `getMessage(channelId, messageId)` - Get specific message
- `editMessage(channelId, messageId, content, options)` - Edit a message
- `deleteMessage(channelId, messageId)` - Delete a message

### Webhook Methods
- `getChannelWebhooks(channelId)` - Get channel webhooks
- `createWebhook(channelId, name, avatar)` - Create a webhook
- `getWebhook(webhookId)` - Get webhook information
- `modifyWebhook(webhookId, name, avatar)` - Modify a webhook
- `deleteWebhook(webhookId)` - Delete a webhook
- `executeWebhook(webhookId, webhookToken, content, options)` - Execute webhook

## Authentication

This module uses OAuth2 authentication. The authentication flow requires:

1. Redirecting users to Discord's authorization URL
2. Handling the callback with the authorization code
3. Exchanging the code for access and refresh tokens

## Rate Limiting

Discord has strict rate limits. This module does not implement automatic rate limiting - you should implement appropriate delays and retry logic in your application.

## Documentation

For detailed Discord API documentation, visit: https://discord.com/developers/docs