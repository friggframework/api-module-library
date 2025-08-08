# Pusher API Module

A comprehensive Pusher API module for the Frigg framework, providing real-time channels, presence features, and event broadcasting capabilities.

## Features

- **Real-time Events**: Trigger events on channels with instant delivery
- **Channel Management**: Public, private, and presence channels
- **Batch Operations**: Send multiple events efficiently
- **Authentication**: Channel authorization for private and presence channels
- **Presence**: Track users joining/leaving presence channels
- **Webhooks**: Handle channel lifecycle events
- **Statistics**: Monitor channel usage and connection stats
- **Security**: HMAC signature verification for webhooks

## Installation

```bash
npm install @friggframework/api-module-pusher
```

## Environment Variables

```env
PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_app_key
PUSHER_SECRET=your_app_secret
PUSHER_CLUSTER=us2
PUSHER_USE_TLS=true
```

## Usage

```javascript
const { Api } = require('@friggframework/api-module-pusher');

const pusherApi = new Api({
    app_id: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER
});

// Trigger an event on a channel
await pusherApi.triggerEvent('my-channel', 'my-event', {
    message: 'Hello World!'
});

// Trigger event on multiple channels
await pusherApi.triggerEventToMultipleChannels(
    ['channel-1', 'channel-2'],
    'notification',
    { alert: 'New update available!' }
);

// Get channel information
const channelInfo = await pusherApi.getChannelInfo('presence-chat', {
    info: 'user_count,subscription_count'
});

// Batch trigger multiple events
await pusherApi.triggerMultipleEvents([
    {
        channel: 'channel-1',
        event: 'update',
        data: { status: 'online' }
    },
    {
        channel: 'channel-2',
        event: 'alert',
        data: { message: 'System maintenance' }
    }
]);
```

## Key Methods

### Event Broadcasting
- `triggerEvent(channel, event, data, options)` - Trigger single event
- `triggerEventToMultipleChannels(channels, event, data)` - Broadcast to multiple channels
- `triggerMultipleEvents(events)` - Batch trigger events
- `sendBatchNotifications(notifications)` - Send multiple notifications

### Channel Management
- `getChannels(options)` - Get all channels
- `getChannelInfo(channel, options)` - Get channel details
- `getChannelUsers(channel)` - Get users in presence channel
- `isPrivateChannel(channel)` - Check if channel is private
- `isPresenceChannel(channel)` - Check if channel is presence
- `isValidChannelName(channel)` - Validate channel name

### Authentication
- `generateChannelAuth(channel, socketId, customData)` - Generate channel auth
- `generatePresenceChannelAuth(channel, socketId, userData)` - Generate presence auth
- `generateUserAuth(socketId, userData)` - Generate user authentication

### Webhooks
- `validateWebhook(body, signature)` - Validate webhook signature
- `handleWebhook(body, headers)` - Process webhook events

### Statistics
- `getApplicationStats()` - Get app statistics
- `testConnection()` - Test API connection

### Presence
- `notifyUserAdded(channel, userId, userInfo)` - Notify user joined
- `notifyUserRemoved(channel, userId)` - Notify user left

## Channel Types

### Public Channels
- No authentication required
- Anyone can subscribe
- Events visible to all subscribers

### Private Channels
- Require authentication
- Channel names start with `private-`
- Server must authorize subscriptions

### Presence Channels
- Include user presence information
- Channel names start with `presence-`
- Track who's online in real-time
- Provide member lists and user info

## Authentication Flow

For private and presence channels, implement server-side authentication:

```javascript
// In your authentication endpoint
app.post('/pusher/auth', (req, res) => {
    const socketId = req.body.socket_id;
    const channel = req.body.channel_name;
    
    // Verify user can access this channel
    if (userCanAccessChannel(user, channel)) {
        const auth = pusherApi.generateChannelAuth(channel, socketId);
        res.send(auth);
    } else {
        res.status(403).send('Forbidden');
    }
});
```

## Webhook Events

Pusher can send webhooks for:
- Channel occupied (first subscriber)
- Channel vacated (last subscriber left)
- Member added (presence channels)
- Member removed (presence channels)

## Error Handling

All methods include proper error handling and will throw descriptive errors for authentication issues, invalid channels, or API limits.