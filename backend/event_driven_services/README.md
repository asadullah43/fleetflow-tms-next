# event_driven_services

Reserved for handlers that react to events (queue consumers, webhooks,
pub/sub subscribers). FleetFlow has none today: every operation is a
direct request/response through `routes/`.

When one is added, put it here as `<topic>.handler.ts`, have it call a
function in `services/` (never Prisma directly), and run its work inside
`runWithTenant(companyId, …)` so tenant isolation applies exactly as it
does for API requests.
