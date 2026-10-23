# Backend schema conventions


## Pydantic boundary conventions

External typed write payloads reject unknown fields so misspelled or stale keys
produce a validation error instead of a successful write that drops data. This
includes nested typed write records. Keep arbitrary JSON fields (preferences,
provider data, and versioned import documents) open according to their own
contracts; do not apply a request base to response models or identity-provider
claims. Clients must send the documented request fields rather than spread an
entire response object into a write.

Use `ConfigDict` for model configuration and `SettingsConfigDict` for
`BaseSettings`. Keep environment prefixes, settings sources, and initialization
behavior specific to each application. A dependency upgrade does not require
switching settings caching APIs.

Reuse constrained `Annotated` value types when fields have the same contract.
Concrete schemas own defaults, nullability, and field descriptions. Preserve the
difference between omitted fields and explicit `null` on partial updates. Use
`EmailStr` for user-entered email addresses, while retaining stored response and
identity-provider claim formats. Declare Pydantic directly when importing it and
request its `email` extra only when email validation is used.

These conventions change validation before a write is executed; they do not
change retry, ownership, or transaction semantics.
