package dk.sdu.cloud.plugins

import dk.sdu.cloud.accounting.api.Product
import dk.sdu.cloud.app.orchestrator.api.*
import dk.sdu.cloud.calls.BulkRequest
import dk.sdu.cloud.calls.BulkResponse
import dk.sdu.cloud.calls.HttpStatusCode
import dk.sdu.cloud.calls.RPCException
import dk.sdu.cloud.config.*
import kotlinx.coroutines.channels.ReceiveChannel

interface ComputePlugin : ResourcePlugin<Product.Compute, ComputeSupport, Job, ConfigSchema.Plugins.Jobs> {
    suspend fun PluginContext.extendBulk(request: JobsProviderExtendRequest): JobsExtendResponse {
        return BulkResponse(request.items.map { extend(it) })
    }

    suspend fun PluginContext.extend(request: JobsProviderExtendRequestItem)

    suspend fun PluginContext.suspendBulk(request: JobsProviderSuspendRequest): JobsProviderSuspendResponse {
        request.items.forEach { suspendJob(it) }
        return BulkResponse(request.items.map { Unit })
    }

    suspend fun PluginContext.suspendJob(request: JobsProviderSuspendRequestItem)

    suspend fun PluginContext.terminateBulk(request: BulkRequest<Job>): BulkResponse<Unit?> {
        return BulkResponse(request.items.map { terminate(it) })
    }

    suspend fun PluginContext.terminate(resource: Job)

    suspend fun FollowLogsContext.follow(job: Job)

    class FollowLogsContext(
        delegate: PluginContext,
        val isActive: () -> Boolean,
        val emitStdout: (rank: Int, message: String) -> Unit,
        val emitStderr: (rank: Int, message: String) -> Unit,
    ) : PluginContext by delegate

    suspend fun PluginContext.verify(jobs: List<Job>) {}

    suspend fun PluginContext.retrieveClusterUtilization(): JobsProviderUtilizationResponse

    suspend fun PluginContext.openInteractiveSessionBulk(
        request: JobsProviderOpenInteractiveSessionRequest
    ): JobsProviderOpenInteractiveSessionResponse {
        return JobsProviderOpenInteractiveSessionResponse(request.items.map { openInteractiveSession(it) })
    }

    suspend fun PluginContext.openInteractiveSession(job: JobsProviderOpenInteractiveSessionRequestItem): OpenSession {
        throw RPCException("Interactive sessions are not supported by this cluster", HttpStatusCode.BadRequest)
    }

    override suspend fun PluginContext.delete(resource: Job) {
        // Not supported by compute plugins
    }

    suspend fun PluginContext.canHandleShellSession(request: ShellRequest.Initialize): Boolean {
        return false
    }

    class ShellContext(
        delegate: PluginContext,
        val isActive: () -> Boolean,
        val receiveChannel: ReceiveChannel<ShellRequest>,
        val emitData: (data: String) -> Unit,
    ) : PluginContext by delegate

    suspend fun ShellContext.handleShellSession(request: ShellRequest.Initialize) {
        // Do nothing
    }
}
