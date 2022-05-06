package dk.sdu.cloud.controllers

import dk.sdu.cloud.config.*
import dk.sdu.cloud.http.RpcServer
import dk.sdu.cloud.ipc.IpcServer
import dk.sdu.cloud.plugins.PluginContext

interface Controller {
    fun RpcServer.configure()
    fun configureIpc(server: IpcServer) {}
}

class ControllerContext(
    val ownExecutable: String,
    val configuration: VerifiedConfig,
    val pluginContext: PluginContext,
)
