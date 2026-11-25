# pipedrive

This is the API Module for pipedrive that allows the [Frigg](https://friggframework.org) code to talk to the pipedrive API.

Read more on the [Frigg documentation site](https://docs.friggframework.org/api-modules/list/pipedrive

## Rate limits

`Api.rateLimit` tells the Frigg Requester how Pipedrive limits calls. The numbers come from [Pipedrive's rate limiting guide](https://pipedrive.readme.io/docs/core-api-concepts-rate-limiting).

- **Burst:** a rolling 2 second window, counted per token. An OAuth app gets 80 requests in the window on the Lite plan, 160 on Growth, 400 on Premium and 480 on Ultimate. The module declares 80, the lowest. Pipedrive reports the real figure in `x-ratelimit-limit`.
- **A throttled call** returns `429`. One with no requests left in the 2 second window (`x-ratelimit-remaining: 0`) is a burst limit. The Requester waits for `Retry-After` when the response has one, and otherwise for `x-ratelimit-reset` (in seconds), then retries. A `429` with neither header keeps the fixed backoff ladder.

### Known gaps

- **The daily token budget is not classified.** Each company has a budget of 30,000 tokens times a plan multiplier times the number of seats, reset at midnight in Pipedrive's server time zone. When it is spent, every call gets a `429`. Pipedrive documents no header or body that marks that `429`, so the module handles it as a burst limit and retries on its wait until midnight.
- **A throttled search is not told apart.** The search endpoints (`searchPersons`, `search`) have their own limit of 10 requests per 2 seconds on every plan. The Requester does not pass the request URL to `classify`, so a throttled search gets the wait of any other `429`.

Fixing either needs a real `429` sample that marks it, or a core that passes the URL to `classify`.
