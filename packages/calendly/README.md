# Calendly API Module

A comprehensive Calendly API v2 integration module for the Frigg Framework.

## Setup

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
CALENDLY_CLIENT_ID=your_calendly_client_id
CALENDLY_CLIENT_SECRET=your_calendly_client_secret
CALENDLY_SCOPE=default
REDIRECT_URI=your_redirect_uri_base
```

### Getting Calendly API Credentials

1. Go to the [Calendly Developer Portal](https://developer.calendly.com/)
2. Sign in with your Calendly account
3. Create a new app in your developer dashboard
4. Get your Client ID and Client Secret
5. Set up your redirect URI (e.g., `https://yourdomain.com/calendly`)

### OAuth2 Scopes

Calendly uses a single scope system. Use `default` for most applications, which provides access to:
- Read user profile information
- Read event types
- Read scheduled events and invitees
- Manage webhooks
- Read organization data

## Usage

```javascript
const { Api } = require('@friggframework/api-module-calendly');

// Initialize with credentials
const calendlyApi = new Api({
    client_id: process.env.CALENDLY_CLIENT_ID,
    client_secret: process.env.CALENDLY_CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URI + '/calendly',
    scope: 'default'
});

// Get authorization URL
const authUrl = calendlyApi.getAuthUri();

// Exchange code for tokens
const tokens = await calendlyApi.getTokenFromCode(authorizationCode);

// Get current user
const user = await calendlyApi.getCurrentUser();

// Get user's event types
const eventTypes = await calendlyApi.getUserEventTypes(user.resource.uri);
```

## Available Methods

### Users Methods
- `getCurrentUser()` - Get current authenticated user
- `getUser(userUri)` - Get specific user by URI

### Organizations Methods
- `getOrganizationMemberships(params)` - Get organization memberships
- `getOrganization(organizationUri)` - Get organization details

### Event Types Methods
- `getEventTypes(params)` - Get event types with filters
- `getUserEventTypes(userUri, params)` - Get event types for specific user
- `getEventType(eventTypeUri)` - Get specific event type

### Scheduled Events Methods
- `getScheduledEvents(params)` - Get scheduled events with filters
- `getScheduledEvent(eventUri)` - Get specific scheduled event
- `getScheduledEventInvitees(eventUri, params)` - Get invitees for event
- `cancelScheduledEvent(eventUri, reason)` - Cancel a scheduled event

### Invitees Methods
- `getInvitee(inviteeUri)` - Get specific invitee
- `createInviteeNoShow(inviteeUri)` - Mark invitee as no-show
- `deleteInviteeNoShow(inviteeUri)` - Remove no-show status

### Webhooks Methods
- `getWebhooks(params)` - List webhook subscriptions
- `createWebhook(webhookData)` - Create webhook subscription
- `getWebhook(webhookUri)` - Get webhook details
- `deleteWebhook(webhookUri)` - Delete webhook subscription

### Availability Methods
- `getUserAvailabilitySchedules(userUri, params)` - Get user's availability schedules
- `getAvailabilitySchedule(scheduleUri)` - Get specific availability schedule

### Routing Forms Methods
- `getRoutingForms(params)` - Get routing forms
- `getRoutingForm(formUri)` - Get specific routing form
- `getRoutingFormSubmissions(formUri, params)` - Get form submissions

### Helper Methods
- `getUserScheduledEvents(userUri, params)` - Get events for specific user
- `getOrganizationScheduledEvents(organizationUri, params)` - Get events for organization
- `getUserUpcomingEvents(userUri, maxStartTime)` - Get upcoming events for user
- `extractUriFromUrl(url)` - Extract URI from full Calendly URLs

## Usage Examples

### Getting User's Event Types
```javascript
const user = await calendlyApi.getCurrentUser();
const eventTypes = await calendlyApi.getUserEventTypes(user.resource.uri);

console.log('Available event types:');
eventTypes.collection.forEach(eventType => {
    console.log(`- ${eventType.name}: ${eventType.scheduling_url}`);
});
```

### Getting Scheduled Events
```javascript
const user = await calendlyApi.getCurrentUser();

// Get events for the next 30 days
const upcomingEvents = await calendlyApi.getUserUpcomingEvents(user.resource.uri);

console.log('Upcoming events:');
upcomingEvents.collection.forEach(event => {
    console.log(`- ${event.name} at ${event.start_time}`);
});
```

### Setting up Webhooks
```javascript
const user = await calendlyApi.getCurrentUser();

const webhookData = {
    url: 'https://yoursite.com/webhooks/calendly',
    events: [
        'invitee.created',
        'invitee.canceled'
    ],
    organization: user.resource.current_organization,
    scope: 'organization'
};

const webhook = await calendlyApi.createWebhook(webhookData);
console.log('Webhook created:', webhook.resource.uri);
```

### Getting Event Details with Invitees
```javascript
const events = await calendlyApi.getScheduledEvents({
    user: userUri,
    status: 'active'
});

for (const event of events.collection) {
    const invitees = await calendlyApi.getScheduledEventInvitees(event.uri);
    
    console.log(`Event: ${event.name}`);
    console.log(`Invitees: ${invitees.collection.length}`);
    
    invitees.collection.forEach(invitee => {
        console.log(`- ${invitee.name} (${invitee.email})`);
    });
}
```

### Canceling an Event
```javascript
const reason = 'Meeting needs to be rescheduled due to emergency';
await calendlyApi.cancelScheduledEvent(eventUri, reason);
console.log('Event canceled successfully');
```

### Working with Organizations
```javascript
const memberships = await calendlyApi.getOrganizationMemberships();

for (const membership of memberships.collection) {
    const org = await calendlyApi.getOrganization(membership.organization);
    console.log(`Organization: ${org.resource.name}`);
}
```

## URI Handling

Calendly API uses URIs (not IDs) to reference resources. URIs look like:
- User: `https://api.calendly.com/users/AAAAAAAAAAAAAAAA`
- Event Type: `https://api.calendly.com/event_types/AAAAAAAAAAAAAAAA`
- Scheduled Event: `https://api.calendly.com/scheduled_events/AAAAAAAAAAAAAAAA`

The module includes a helper method `extractUriFromUrl()` to work with these URIs.

## Authentication Flow

Calendly uses OAuth2:

1. Redirect users to Calendly's authorization URL
2. Handle the callback with the authorization code
3. Exchange the code for access and refresh tokens
4. Use tokens for API requests

## Error Handling

Calendly returns detailed error information. Always wrap API calls in try-catch blocks:

```javascript
try {
    const events = await calendlyApi.getScheduledEvents();
    console.log('Events retrieved successfully');
} catch (error) {
    console.error('Calendly error:', error.message);
    if (error.details) {
        console.error('Error details:', error.details);
    }
}
```

## Rate Limiting

Calendly enforces rate limits on API requests. The module does not implement automatic retry logic - you should handle rate limiting in your application.

## Webhooks

Calendly can send webhooks for various events:
- `invitee.created` - New booking created
- `invitee.canceled` - Booking canceled
- `invitee.rescheduled` - Booking rescheduled
- `invitee_no_show.created` - Invitee marked as no-show
- `invitee_no_show.deleted` - No-show status removed

## Documentation

For detailed Calendly API documentation, visit: https://developer.calendly.com/