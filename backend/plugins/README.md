# plugins

Reserved for adapters to external systems (payment gateways, SMS/email
providers, GPS tracking, the ZATCA Phase-2 clearance API). FleetFlow has
none today.

When one is added, put it here as `<provider>.plugin.ts`, exporting a
small interface that `services/` call. Credentials come from
`global_config/` (environment variables), are never logged, and never
returned to the frontend.
