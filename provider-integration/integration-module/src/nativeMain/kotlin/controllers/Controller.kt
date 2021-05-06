package dk.sdu.cloud.controllers

import dk.sdu.cloud.H2OServer
import dk.sdu.cloud.plugins.LoadedPlugins
import dk.sdu.cloud.plugins.PluginContext

interface Controller {
    fun H2OServer.configure()
}

class ControllerContext(
    val pluginContext: PluginContext,
    val plugins: LoadedPlugins,
)
