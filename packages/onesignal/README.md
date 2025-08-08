# OneSignal API Module

A comprehensive OneSignal API module for the Frigg framework, providing push notification capabilities for mobile, web, and email platforms.

## Features

- **Push Notifications**: Send notifications to mobile, web, and email
- **Segmentation**: Target specific user segments and tags
- **Scheduling**: Schedule notifications for future delivery
- **Templates**: Create and manage notification templates
- **Device Management**: Track and manage user devices
- **Analytics**: Detailed delivery and engagement analytics
- **Live Activities**: iOS Live Activities support
- **A/B Testing**: Test different notification variations
- **Rich Media**: Images, buttons, and interactive elements

## Installation

```bash
npm install @friggframework/api-module-onesignal
```

## Environment Variables

```env
ONESIGNAL_APP_ID=your_app_id
ONESIGNAL_REST_API_KEY=your_rest_api_key
ONESIGNAL_USER_AUTH_KEY=your_user_auth_key
```

## Usage

```javascript
const { Api } = require('@friggframework/api-module-onesignal');

const oneSignalApi = new Api({
    app_id: process.env.ONESIGNAL_APP_ID,
    rest_api_key: process.env.ONESIGNAL_REST_API_KEY,
    user_auth_key: process.env.ONESIGNAL_USER_AUTH_KEY
});

// Send a simple push notification
await oneSignalApi.sendPushNotification('Hello, World!', {
    included_segments: ['All']
});

// Send to specific users
await oneSignalApi.sendNotificationToUsers(
    'Personal message',
    ['user-id-1', 'user-id-2']
);

// Send rich notification with image and buttons
await oneSignalApi.sendRichNotification(
    'Check out our new feature!',
    { feature_id: 123 },
    {
        big_picture: 'https://example.com/image.jpg',
        buttons: [
            { id: 'view', text: 'View Feature' },
            { id: 'dismiss', text: 'Not Now' }
        ]
    }
);

// Schedule a notification
const sendTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
await oneSignalApi.sendScheduledNotification(
    'Reminder: Check your dashboard',
    sendTime.toISOString()
);
```

## Key Methods

### Notifications
- `sendPushNotification(contents, options)` - Send basic push notification
- `sendNotificationToSegments(contents, segments, options)` - Target segments
- `sendNotificationToUsers(contents, userIds, options)` - Target specific users
- `sendNotificationToTags(contents, tags, options)` - Target by tags
- `sendRichNotification(contents, data, options)` - Send with rich media
- `sendScheduledNotification(contents, sendAfter, options)` - Schedule delivery
- `getNotification(notificationId)` - Get notification details
- `getNotifications(options)` - List notifications
- `cancelNotification(notificationId)` - Cancel scheduled notification

### Device Management
- `getDevices(options)` - Get all devices
- `getDevice(deviceId)` - Get specific device
- `addDevice(deviceData)` - Add new device
- `updateDevice(deviceId, deviceData)` - Update device
- `deleteDevice(deviceId)` - Remove device
- `exportDevices(options)` - Export device list

### Segmentation
- `getSegments(options)` - Get all segments
- `createSegment(segmentData)` - Create new segment
- `deleteSegment(segmentId)` - Delete segment

### Templates
- `getTemplates(options)` - Get all templates
- `createTemplate(templateData)` - Create template
- `updateTemplate(templateId, templateData)` - Update template
- `deleteTemplate(templateId)` - Delete template

### Analytics & Tracking
- `trackSession(deviceId, sessionData)` - Track app session
- `trackPurchase(deviceId, purchaseData)` - Track purchase
- `trackFocus(deviceId, focusData)` - Track app focus
- `getNotificationAnalytics(notificationId)` - Get notification stats
- `getAppAnalytics(days)` - Get app analytics

### Live Activities (iOS)
- `createLiveActivity(liveActivityData)` - Start Live Activity
- `updateLiveActivity(liveActivityId, updateData)` - Update Live Activity
- `deleteLiveActivity(liveActivityId)` - End Live Activity

### App Management
- `getApps()` - Get all apps (requires user auth)
- `getApp(appId)` - Get app details
- `createApp(appData)` - Create new app
- `updateApp(appId, appData)` - Update app settings

## Targeting Options

### Segments
Target predefined user segments:
```javascript
await oneSignalApi.sendNotificationToSegments(
    'Special offer!',
    ['Active Users', 'Subscribed Users']
);
```

### Tags
Target users by custom tags:
```javascript
await oneSignalApi.sendNotificationToTags(
    'Local event nearby!',
    [
        { field: 'tag', key: 'location', relation: '=', value: 'San Francisco' },
        { field: 'tag', key: 'interests', relation: '=', value: 'events' }
    ]
);
```

### Specific Users
Target individual users:
```javascript
await oneSignalApi.sendNotificationToUsers(
    'Your order is ready!',
    ['player-id-1', 'player-id-2']
);
```

## Rich Notifications

Send notifications with images, buttons, and custom data:
```javascript
await oneSignalApi.sendRichNotification(
    'New message from John',
    { 
        conversation_id: 'conv_123',
        sender_id: 'user_456'
    },
    {
        big_picture: 'https://example.com/avatar.jpg',
        buttons: [
            { id: 'reply', text: 'Reply', icon: 'ic_reply' },
            { id: 'mark_read', text: 'Mark as Read' }
        ],
        android_sound: 'notification_sound',
        ios_sound: 'notification.wav'
    }
);
```

## Authentication

OneSignal uses two types of API keys:
- **REST API Key**: For sending notifications and basic operations
- **User Auth Key**: For app management and advanced operations

## Platform Support

- **Mobile**: iOS and Android push notifications
- **Web**: Chrome, Firefox, Safari web push
- **Email**: Email notifications
- **SMS**: SMS messaging (with additional setup)

## Analytics

Track notification performance:
- Delivery rates
- Open rates
- Click-through rates
- Conversion tracking
- Revenue attribution

## Error Handling

Comprehensive error handling with OneSignal API error codes and detailed error messages for debugging delivery issues.