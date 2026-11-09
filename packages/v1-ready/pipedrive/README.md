# pipedrive

This is the API Module for pipedrive that allows the [Frigg](https://friggframework.org) code to talk to the pipedrive API.

Read more on the [Frigg documentation site](https://docs.friggframework.org/api-modules/list/pipedrive

## Rate limits

`Api.rateLimit` tells the Frigg Requester how Pipedrive limits calls. The numbers come from [Pipedrive's rate limiting guide](https://pipedrive.readme.io/docs/core-api-concepts-rate-limiting).

- **Burst:** a rolling 2 second window, counted per token. An OAuth app gets 80 requests in the window on the Lite plan, 160 on Growth, 400 on Premium and 480 on Ultimate. The module declares 80, the lowest. Pipedrive reports the real figure in `x-ratelimit-limit`.
- **A throttled call** returns `429`. The Requester waits for `Retry-After` when the response has one, and otherwise for `x-ratelimit-reset` (in seconds), then retries.
- **Daily token budget:** each company has a budget of 30,000 tokens times a plan multiplier times the number of seats. It resets at midnight in Pipedrive's server time zone. When it is spent, every call gets a `429`. Pipedrive documents no wait time for it, so the module declares none. Unless the response carries `Retry-After` or `x-ratelimit-reset`, such a `429` keeps the fixed backoff ladder, and then the queue redelivers the message.
