package dk.sdu.cloud.calls

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlin.reflect.KProperty1
import kotlin.reflect.full.memberProperties
import kotlin.reflect.full.primaryConstructor

private fun simplifyName(qualifiedName: String): String {
    return qualifiedName.split(".").filter { it.firstOrNull()?.isUpperCase() == true }.joinToString(".")
}

actual fun visualizeValue(value: Any?): DocVisualization {
    if (value is DocVisualizable) return value.visualize()
    if (value == null) return DocVisualization.Inline("null")

    return when (value) {
        is Array<*>, is List<*>, is Set<*> -> {
            val items = (value as? Iterable<*>)?.toList() ?: emptyList()
            if (items.isEmpty()) {
                DocVisualization.Inline("[]")
            } else if (items.size == 1) {
                visualizeValue(items.first())
            } else {
                DocVisualization.Card(
                    "Collection",
                    emptyList(),
                    items.map { visualizeValue(it) }
                )
            }
        }

        is String -> DocVisualization.Inline(value)

        is JsonObject -> {
            DocVisualization.Card(
                "Json",
                value
                    .map { (k, v) -> DocStat(k, visualizeValue(v)) }
                    .chunked(1)
                    .map { DocStatLine(it) },
                emptyList()
            )
        }

        is JsonPrimitive -> {
            DocVisualization.Inline(value.contentOrNull.toString())
        }

        is BulkRequest<*> -> {
            DocVisualization.Card(
                "BulkRequest",
                emptyList(),
                value.items.map { visualizeValue(it) }
            )
        }

        is BulkResponse<*> -> {
            DocVisualization.Card(
                "BulkResponse",
                emptyList(),
                value.responses.map { visualizeValue(it) }
            )
        }

        is Unit -> DocVisualization.Card("Unit", emptyList(), listOf(DocVisualization.Inline("An empty object")))
        is Boolean, is Number -> DocVisualization.Inline(value.toString())
        is Enum<*> -> DocVisualization.Inline(value.name)

        is Map<*, *> -> {
            DocVisualization.Card(
                "Map",
                value
                    .map { (k, v) -> DocStat(k.toString(), visualizeValue(v)) }
                    .chunked(1)
                    .map { DocStatLine(it) },
                emptyList()
            )
        }

        else -> {
            val title = simplifyName(value::class.java.canonicalName)
            val isObject = value::class.objectInstance != null
            if (!isObject) {
                DocVisualization.Card(
                    title,
                    value::class.memberProperties
                        .mapNotNull { member ->
                            @Suppress("UNCHECKED_CAST")
                            member as KProperty1<Any, Any>


                            val propertyValue = member.get(value) as Any?
                            when {
                                propertyValue == null && member.name.startsWith("filter") -> null
                                propertyValue == null && member.name.startsWith("include") -> null
                                propertyValue == null || propertyValue == false -> {
                                    val looksLikeADefault = value::class.primaryConstructor?.parameters
                                        ?.any { it.name == member.name && it.isOptional } == true

                                    if (looksLikeADefault) {
                                        null
                                    } else {
                                        DocStat(member.name, visualizeValue(propertyValue))
                                    }
                                }
                                else -> DocStat(member.name, visualizeValue(propertyValue))
                            }
                        }
                        .chunked(1)
                        .map { DocStatLine(it) }
                        .sortedBy { if (it.stats.single().value is DocVisualization.Inline) 0 else 1 },
                    emptyList()
                )
            } else {
                DocVisualization.Inline(title)
            }
        }
    }
}
