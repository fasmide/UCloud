[UCloud Developer Guide](/docs/developer-guide/README.md) / [Built-in Provider](/docs/developer-guide/built-in-provider/README.md) / [UCloud/Storage](/docs/developer-guide/built-in-provider/storage/README.md) / [File Collections](/docs/developer-guide/built-in-provider/storage/file-collections.md)

# `files.collections.provider.ucloud.retrieveProducts`

[![API: Internal/Beta](https://img.shields.io/static/v1?label=API&message=Internal/Beta&color=red&style=flat-square)](/docs/developer-guide/core/api-conventions.md)
[![Auth: Services](https://img.shields.io/static/v1?label=Auth&message=Services&color=informational&style=flat-square)](/docs/developer-guide/core/types.md#role)


_Retrieve product support for this providers_

| Request | Response | Error |
|---------|----------|-------|
|<code><a href='https://kotlinlang.org/api/latest/jvm/stdlib/kotlin/-unit/'>Unit</a></code>|<code><a href='/docs/reference/dk.sdu.cloud.calls.BulkResponse.md'>BulkResponse</a>&lt;<a href='/docs/reference/dk.sdu.cloud.file.orchestrator.api.FSSupport.md'>FSSupport</a>&gt;</code>|<code><a href='/docs/reference/dk.sdu.cloud.CommonErrorMessage.md'>CommonErrorMessage</a></code>|

This endpoint responds with the [`Product`](/docs/reference/dk.sdu.cloud.accounting.api.Product.md)s supported by
this provider along with details for how [`Product`](/docs/reference/dk.sdu.cloud.accounting.api.Product.md)  is
supported. The [`Product`](/docs/reference/dk.sdu.cloud.accounting.api.Product.md)s must be registered with
UCloud/Core already.

