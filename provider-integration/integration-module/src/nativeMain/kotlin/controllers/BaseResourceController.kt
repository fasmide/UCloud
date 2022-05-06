package dk.sdu.cloud.controllers

import dk.sdu.cloud.ServerMode
import dk.sdu.cloud.accounting.api.Product
import dk.sdu.cloud.accounting.api.ProductReference
import dk.sdu.cloud.accounting.api.providers.ProductSupport
import dk.sdu.cloud.accounting.api.providers.ResourceProviderApi
import dk.sdu.cloud.http.RpcServer
import dk.sdu.cloud.calls.BulkRequest
import dk.sdu.cloud.calls.BulkResponse
import dk.sdu.cloud.calls.HttpStatusCode
import dk.sdu.cloud.calls.RPCException
import dk.sdu.cloud.http.OutgoingCallResponse
import dk.sdu.cloud.plugins.PluginContext
import dk.sdu.cloud.plugins.ResourcePlugin
import dk.sdu.cloud.provider.api.Resource
import kotlinx.coroutines.runBlocking

abstract class BaseResourceController<
    P : Product,
    Sup : ProductSupport,
    Res : Resource<P, Sup>,
    Plugin : ResourcePlugin<P, Sup, Res, *>,
    Api : ResourceProviderApi<Res, *, *, *, *, P, Sup>>(
    protected val controllerContext: ControllerContext,
) : Controller {
    protected abstract fun retrievePlugins(): Collection<Plugin>?
    protected abstract fun retrieveApi(providerId: String): Api

    protected fun lookupPluginOrNull(product: ProductReference): Plugin? {
        return retrievePlugins()?.find { plugin ->
            plugin.productAllocation.any { it.id == product.id && it.category == product.category }
        } 
    }

    protected fun lookupPlugin(product: ProductReference): Plugin {
        return lookupPluginOrNull(product) ?: throw RPCException.fromStatusCode(HttpStatusCode.InternalServerError)
    }

    protected fun <Request : Any, Response> dispatchToPlugin(
        plugins: Collection<Plugin>,
        items: List<Request>,
        selector: (Request) -> Res,
        dispatcher: suspend PluginContext.(plugin: Plugin, request: BulkRequest<Request>) -> BulkResponse<Response>
    ): BulkResponse<Response> {
        val response = ArrayList<Response?>()
        repeat(items.size) { response.add(null) }

        groupResources(plugins, items, selector).forEach { (plugin, group) ->
            with(controllerContext.pluginContext) {
                val pluginResponse = runBlocking { dispatcher(plugin, BulkRequest(group.map { it.item })) }
                pluginResponse.responses.forEachIndexed { index, resp ->
                    response[group[index].originalIndex] = resp
                }
            }
        }

        @Suppress("UNCHECKED_CAST")
        return BulkResponse(response as List<Response>)
    }

    protected data class ReorderedItem<T>(val originalIndex: Int, val item: T)

    protected fun <T> groupResources(
        plugins: Collection<Plugin>,
        items: List<T>,
        selector: (T) -> Res,
    ): Map<Plugin, List<ReorderedItem<T>>> {
        val result = HashMap<Plugin, ArrayList<ReorderedItem<T>>>()
        for ((index, item) in items.withIndex()) {
            val job = selector(item)
            val product = job.specification.product
            val plugin = lookupPluginOrNull(product) ?: continue
            val existing = result[plugin] ?: ArrayList()
            existing.add(ReorderedItem(index, item))
            result[plugin] = existing
        }
        return result
    }

    protected abstract fun RpcServer.configureCustomEndpoints(plugins: Collection<Plugin>, api: Api)

    override fun RpcServer.configure() {
        val plugins = retrievePlugins()
        if (plugins == null) {
            println("No plugins active for ${this@BaseResourceController::class.simpleName}")
            return
        }
        val serverMode = controllerContext.configuration.serverMode
        val api = retrieveApi(controllerContext.configuration.core.providerId)

        implement(api.create) {
            if (serverMode != ServerMode.User) throw RPCException.fromStatusCode(HttpStatusCode.NotFound)

            OutgoingCallResponse.Ok(
                dispatchToPlugin(plugins, request.items, { it }) { plugin, request ->
                    with(plugin) { createBulk(request) }
                }
            )
        }

        implement(api.retrieveProducts) {
            if (serverMode != ServerMode.Server) throw RPCException.fromStatusCode(HttpStatusCode.NotFound)
            runBlocking {
                OutgoingCallResponse.Ok(
                    BulkResponse(
                        plugins
                            .flatMap { plugin ->
                                val products = plugin.productAllocation
                                with(controllerContext.pluginContext) {
                                    with(plugin) {
                                        val providerId = controllerContext.configuration.core.providerId
                                        retrieveProducts(
                                            products.map { product ->
                                                ProductReference(
                                                    product.id,
                                                    product.category,
                                                    providerId
                                                )
                                            }
                                        ).responses
                                    }
                                }
                            }
                    )
                )
            }
        }

        api.delete?.let { delete ->
            implement(delete) {
                if (serverMode != ServerMode.User) throw RPCException.fromStatusCode(HttpStatusCode.NotFound)

                OutgoingCallResponse.Ok(
                    dispatchToPlugin(plugins, request.items, { it }) { plugin, request ->
                        with(plugin) { deleteBulk(request) }
                    }
                )
            }
        }

        implement(api.verify) {
            if (serverMode != ServerMode.Server) throw RPCException.fromStatusCode(HttpStatusCode.NotFound)
            dispatchToPlugin(plugins, request.items, { it }) { plugin, request ->
                with(plugin) {
                    verify(request)
                    BulkResponse(emptyList<Unit>())
                }
            }

            OutgoingCallResponse.Ok(Unit)
        }

        implement(api.init) {
            if (serverMode != ServerMode.User) throw RPCException.fromStatusCode(HttpStatusCode.NotFound)
            plugins.forEach { plugin ->
                with(controllerContext.pluginContext) {
                    with(plugin) {
                        init(request.principal)
                    }
                }
            }

            OutgoingCallResponse.Ok(Unit)
        }

        configureCustomEndpoints(plugins, api)
    }
}

