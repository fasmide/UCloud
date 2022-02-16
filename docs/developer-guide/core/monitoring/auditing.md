<p align='center'>
<a href='/docs/developer-guide/core/monitoring/introduction.md'>« Previous section</a>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href='/docs/developer-guide/core/monitoring/auditing-scenario.md'>Next section »</a>
</p>


[UCloud Developer Guide](/docs/developer-guide/README.md) / [Core](/docs/developer-guide/core/README.md) / [Monitoring, Alerting and Procedures](/docs/developer-guide/core/monitoring/README.md) / Auditing
# Auditing

[![API: Internal/Stable](https://img.shields.io/static/v1?label=API&message=Internal/Stable&color=red&style=flat-square)](/docs/developer-guide/core/api-conventions.md)


## Introduction           

Auditing is automatically performed for all HTTP calls implemented via the
`implement` DSL. If you have written a `callDescription` then auditing is
entirely automatic. There are, however, a few cases you need to be aware of.
We outline the most important things in this document.

## How Does It Work?

The auditing feature is written as a piece of middleware for ktor. It logs all
calls made to the backend. It is further enriched by metadata provided by the
`callDescription`.

The resulting audit log is dispatched to the event stream in two different topics.

---

The topic `http.logs` contains the audit log of all services. These audit logs are consumed and pushed into
Elasticsearch for storage. If breaking changes are made to the underlying audit messages then the Elasticsearch indexes
may break. This can potentially cause messages to no longer reach Elasticsearch (and get stuck at the Logstash step).
Because of this, it is important that breaking changes are not made without manual migration. This is also mention in
the [deployment checklist](./deployment.md).

Additionally, there is an audit topic for each namespace. Services may consume
from this topic to build services for advanced monitoring. The topics are named
`audit.<namespace>`.

---

The following information audited for each request (See the source code in
`service-lib` for the most up-to-date version):

```
data class ServiceDefinition(
    val name: String,
    val version: String
)

data class ServiceInstance(
    val definition: ServiceDefinition, 
    val hostname: String, 
    val port: Int
)

data class SecurityPrincipalToken(
    val principal: SecurityPrincipal,
    val scopes: List<SecurityScope>,
    val issuedAt: Long,
    val expiresAt: Long,
    val publicSessionReference: String?
)

data class HttpCallLogEntry(
    val jobId: String,
    val handledBy: ServiceInstance,
    val causedBy: String?,

    val requestName: String,
    val httpMethod: String,
    val uri: String,
    val userAgent: String?,
    val remoteOrigin: String,

    val token: SecurityPrincipalToken?,
    val requestContentType: String?,
    val requestSize: Long,
    val requestJson: Any?,

    val responseCode: Int,
    val responseTime: Long,
    val responseContentType: String,
    val responseSize: Long,
    val responseJson: Any?
)
```

## Dealing With Sensitive Request Data

In this section, "sensitive data" is any kind of data which shouldn't be accessible through the audit logs. It may include
any kind of data that would by law be classified as sensitive, but it may also contain other types of data.

We don't want sensitive data in our logs. The audit log should allow us to clearly audit the actions of a user, but it
should not contain sensitive data, such as passwords. If you are writing a call which will need to accept sensitive data
you need to declare an alternative request type which has this sensitive data redacted. 

In the call description you should add:

```kotlin
audit<AuditType>()
```

It other cases the request type itself might not contain enough information
to be useful. In these cases you should also use `audit()` to ensure that
additional useful information is attached to the audit message.

## Verification Procedure

The following document describes how to verify that auditing works as intended:
[Auditing Scenario](auditing-scenario.md).

