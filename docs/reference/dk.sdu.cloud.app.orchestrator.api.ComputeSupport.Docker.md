[UCloud Developer Guide](/docs/developer-guide/README.md) / [Orchestration of Resources](/docs/developer-guide/orchestration/README.md) / [Compute](/docs/developer-guide/orchestration/compute/README.md) / [Jobs](/docs/developer-guide/orchestration/compute/jobs.md)

# `ComputeSupport.Docker`


[![API: Internal/Beta](https://img.shields.io/static/v1?label=API&message=Internal/Beta&color=red&style=flat-square)](/docs/developer-guide/core/api-conventions.md)



```kotlin
data class Docker(
    val enabled: Boolean?,
    val web: Boolean?,
    val vnc: Boolean?,
    val logs: Boolean?,
    val terminal: Boolean?,
    val peers: Boolean?,
    val timeExtension: Boolean?,
    val utilization: Boolean?,
)
```

<details>
<summary>
<b>Properties</b>
</summary>

<details>
<summary>
<code>enabled</code>: <code><code><a href='https://kotlinlang.org/api/latest/jvm/stdlib/kotlin/-boolean/'>Boolean</a>?</code></code> Flag to enable/disable this feature
</summary>



All other flags are ignored if this is `false`.


</details>

<details>
<summary>
<code>web</code>: <code><code><a href='https://kotlinlang.org/api/latest/jvm/stdlib/kotlin/-boolean/'>Boolean</a>?</code></code> Flag to enable/disable the interactive interface of `WEB` `Application`s
</summary>





</details>

<details>
<summary>
<code>vnc</code>: <code><code><a href='https://kotlinlang.org/api/latest/jvm/stdlib/kotlin/-boolean/'>Boolean</a>?</code></code> Flag to enable/disable the interactive interface of `VNC` `Application`s
</summary>





</details>

<details>
<summary>
<code>logs</code>: <code><code><a href='https://kotlinlang.org/api/latest/jvm/stdlib/kotlin/-boolean/'>Boolean</a>?</code></code> Flag to enable/disable the log API
</summary>





</details>

<details>
<summary>
<code>terminal</code>: <code><code><a href='https://kotlinlang.org/api/latest/jvm/stdlib/kotlin/-boolean/'>Boolean</a>?</code></code> Flag to enable/disable the interactive terminal API
</summary>





</details>

<details>
<summary>
<code>peers</code>: <code><code><a href='https://kotlinlang.org/api/latest/jvm/stdlib/kotlin/-boolean/'>Boolean</a>?</code></code> Flag to enable/disable connection between peering `Job`s
</summary>





</details>

<details>
<summary>
<code>timeExtension</code>: <code><code><a href='https://kotlinlang.org/api/latest/jvm/stdlib/kotlin/-boolean/'>Boolean</a>?</code></code> Flag to enable/disable extension of jobs
</summary>





</details>

<details>
<summary>
<code>utilization</code>: <code><code><a href='https://kotlinlang.org/api/latest/jvm/stdlib/kotlin/-boolean/'>Boolean</a>?</code></code> Flag to enable/disable the retrieveUtilization of jobs
</summary>





</details>



</details>


