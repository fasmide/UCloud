[UCloud Developer Guide](/docs/developer-guide/README.md) / [Accounting and Project Management](/docs/developer-guide/accounting-and-projects/README.md) / [Grants](/docs/developer-guide/accounting-and-projects/grants/README.md) / [Allocation Process](/docs/developer-guide/accounting-and-projects/grants/grants.md)

# `ProjectApplicationSettings`


[![API: Internal/Beta](https://img.shields.io/static/v1?label=API&message=Internal/Beta&color=red&style=flat-square)](/docs/developer-guide/core/api-conventions.md)


_Settings for grant Applications_

```kotlin
data class ProjectApplicationSettings(
    val automaticApproval: AutomaticApprovalSettings,
    val allowRequestsFrom: List<UserCriteria>,
    val excludeRequestsFrom: List<UserCriteria>,
)
```
A user will be allowed to apply for grants to this project if they match any of the criteria listed in
`allowRequestsFrom`.

<details>
<summary>
<b>Properties</b>
</summary>

<details>
<summary>
<code>automaticApproval</code>: <code><code><a href='#automaticapprovalsettings'>AutomaticApprovalSettings</a></code></code>
</summary>





</details>

<details>
<summary>
<code>allowRequestsFrom</code>: <code><code><a href='https://kotlinlang.org/api/latest/jvm/stdlib/kotlin.collections/-list/'>List</a>&lt;<a href='#usercriteria'>UserCriteria</a>&gt;</code></code>
</summary>





</details>

<details>
<summary>
<code>excludeRequestsFrom</code>: <code><code><a href='https://kotlinlang.org/api/latest/jvm/stdlib/kotlin.collections/-list/'>List</a>&lt;<a href='#usercriteria'>UserCriteria</a>&gt;</code></code>
</summary>





</details>



</details>


