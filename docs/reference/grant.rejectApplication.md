[UCloud Developer Guide](/docs/developer-guide/README.md) / [Accounting and Project Management](/docs/developer-guide/accounting-and-projects/README.md) / [Grants](/docs/developer-guide/accounting-and-projects/grants/README.md) / [Allocation Process](/docs/developer-guide/accounting-and-projects/grants/grants.md)

# `grant.rejectApplication`

[![API: Internal/Beta](https://img.shields.io/static/v1?label=API&message=Internal/Beta&color=red&style=flat-square)](/docs/developer-guide/core/api-conventions.md)
[![Auth: Users](https://img.shields.io/static/v1?label=Auth&message=Users&color=informational&style=flat-square)](/docs/developer-guide/core/types.md#role)


_Rejects an [Application]_

| Request | Response | Error |
|---------|----------|-------|
|<code><a href='#rejectapplicationrequest'>RejectApplicationRequest</a></code>|<code><a href='https://kotlinlang.org/api/latest/jvm/stdlib/kotlin/-unit/'>Unit</a></code>|<code><a href='/docs/reference/dk.sdu.cloud.CommonErrorMessage.md'>CommonErrorMessage</a></code>|

The [Application] cannot receive any new change to it and the [Application] creator must re-submit the
[Application].

Only the grant reviewer can perform this action.

