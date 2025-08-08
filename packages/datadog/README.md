# Datadog API Module

A Frigg API Module for Datadog integration.

## Installation

```bash
npm install @friggframework/datadog
```

## Configuration

### Environment Variables

```bash
DATADOG_API_KEY=your_api_key
DATADOG_APPLICATION_KEY=your_application_key
```

## Usage

```javascript
const { Api, Definition } = require('@friggframework/datadog');

// Initialize API client
const api = new Api({
    apiKey: 'your_api_key',
    applicationKey: 'your_application_key'
});

// Validate API key
const validation = await api.validateApiKey();

// Submit metrics
await api.submitMetrics({
    series: [{
        metric: 'my.metric',
        points: [[Date.now() / 1000, 1]],
        tags: ['environment:production']
    }]
});
```

## API Methods

### Validation
- `validateApiKey()` - Validate API credentials

### Metrics
- `submitMetrics(data)` - Submit metrics to Datadog

### Events
- `createEvent(event)` - Create an event
- `listEvents(params)` - List events

### Logs
- `searchLogs(query)` - Search logs

### Dashboards
- `listDashboards()` - List dashboards
- `createDashboard(dashboard)` - Create dashboard

### Monitors
- `listMonitors()` - List monitors
- `createMonitor(monitor)` - Create monitor

## Testing

```bash
npm test
```

## License

MIT
