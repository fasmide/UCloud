package dk.sdu.cloud.plugins

import dk.sdu.cloud.accounting.api.Product
import dk.sdu.cloud.app.orchestrator.api.*
import dk.sdu.cloud.calls.BulkRequest
import dk.sdu.cloud.calls.BulkResponse
import dk.sdu.cloud.calls.RPCException
import io.ktor.http.*

interface ComputePlugin : ResourcePlugin<Product.Compute, ComputeSupport, Job> {
    suspend fun PluginContext.extendBulk(request: JobsProviderExtendRequest): JobsExtendResponse {
        return BulkResponse(request.items.map { extend(it) })
    }

    suspend fun PluginContext.extend(request: JobsProviderExtendRequestItem)

    suspend fun PluginContext.suspendBulk(request: JobsProviderSuspendRequest): JobsProviderSuspendResponse {
        request.items.forEach { suspendJob(it) }
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
}
