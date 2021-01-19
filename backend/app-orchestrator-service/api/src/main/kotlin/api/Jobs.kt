package dk.sdu.cloud.app.orchestrator.api

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import com.fasterxml.jackson.databind.annotation.JsonDeserialize
import dk.sdu.cloud.AccessRight
import dk.sdu.cloud.CommonErrorMessage
import dk.sdu.cloud.FindByStringId
import dk.sdu.cloud.accounting.api.Product
import dk.sdu.cloud.accounting.api.ProductReference
import dk.sdu.cloud.app.store.api.*
import dk.sdu.cloud.calls.CallDescriptionContainer
import dk.sdu.cloud.calls.BulkRequest
import dk.sdu.cloud.calls.UCloudApiDoc
import dk.sdu.cloud.calls.*
import dk.sdu.cloud.calls.UCloudApiExperimental
import dk.sdu.cloud.service.*
import io.ktor.http.*

enum class JobState {
    @UCloudApiDoc(
        "Any job which has been submitted and not yet in a final state where the number of tasks running is less than" +
            "the number of tasks requested"
    )
    IN_QUEUE,

    @UCloudApiDoc("A job where all the tasks are running")
    RUNNING,

    @UCloudApiDoc("A job which has been cancelled, either by user request or system request")
    CANCELING,

    @UCloudApiDoc(
        "A job which has terminated. The job terminated with no _scheduler_ error.\n\n" +
            "Note: A job will complete successfully even if the user application exits with an unsuccessful " +
            "status code."
    )
    SUCCESS,

    @UCloudApiDoc(
        "A job which has terminated with a failure.\n\n" +
            "Note: A job will fail _only_ if it is the scheduler's fault"
    )
    FAILURE,

    @UCloudApiDoc("A job which has expired and was terminated as a result")
    EXPIRED;

    fun isFinal(): Boolean =
        when (this) {
            SUCCESS, FAILURE, EXPIRED -> true
            else -> false
        }
}

enum class InteractiveSessionType {
    WEB,
    VNC,
    SHELL
}

@UCloudApiDoc(
"""A `Job` in UCloud is the core abstraction used to describe a unit of computation. `Job`s provider users a way to run
their computations through a workflow similar to their own workstations but scaling to much bigger and more machines. In
a simplified view, a `Job` describes the following information:

- The `Application` which the provider should/is/has run (see [app-store](/backend/app-store-service/README.md))
- The [input parameters](/backend/app-orchestrator-service/wiki/parameters.md),
  [files and other resources](/backend/app-orchestrator-service/wiki/resources.md) required by a `Job`
- A reference to the appropriate [compute infrastructure](/backend/app-orchestrator-service/wiki/products.md), this
  includes a reference to the _provider_
- The user who launched the `Job` and in which [`Project`](/backend/project-service/README.md)

A `Job` is started by a user request containing the `parameters` of a `Job`. This information is verified by the UCloud
orchestrator and passed to the provider referenced by the `Job` itself. Assuming that the provider accepts this
information, the `Job` is placed in its initial state, `IN_QUEUE`. You can read more about the requirements of the
compute environment and how to launch the software
correctly [here](/backend/app-orchestrator-service/wiki/job_launch.md).

At this point, the provider has acted on this information by placing the `Job` in its own equivalent of
a [job queue](/backend/app-orchestrator-service/wiki/queue.md). Once the provider realizes that the `Job` is running, it
will contact UCloud and place the `Job` in the `RUNNING` state. This indicates to UCloud that log files can be retrieved
and that [interactive interfaces](/backend/app-orchestrator-service/wiki/interactive.md) (`VNC`/`WEB`) are available.

Once the `Application` terminates at the provider, the provider will update the state to `SUCCESS`. A `Job` has
terminated successfully if no internal error occurred in UCloud and in the provider. This means that a `Job` whose
software returns with a non-zero exit code is still considered successful. A `Job` might, for example, be placed
in `FAILURE` if the `Application` crashed due to a hardware/scheduler failure. Both `SUCCESS` or `FAILURE` are terminal
state. Any `Job` which is in a terminal state can no longer receive any updates or change its state.

At any point after the user submits the `Job`, they may request cancellation of the `Job`. This will stop the `Job`,
delete any [ephemeral resources](/backend/app-orchestrator-service/wiki/resources.md) and release
any [bound resources](/backend/app-orchestrator-service/wiki/resources.md).""")
@UCloudApiExperimental(ExperimentalLevel.ALPHA)
data class Job(
    @UCloudApiDoc(
        "Unique identifier for this job.\n\n" +
            "UCloud guarantees that no other job, regardless of compute provider, has the same unique identifier."
    )
    val id: String,

    @UCloudApiDoc("A reference to the owner of this job")
    val owner: JobOwner,

    @UCloudApiDoc(
        "A list of status updates from the compute backend.\n\n" +
            "The status updates tell a story of what happened with the job. " +
            "This list is ordered by the timestamp in ascending order. " +
            "The current state of the job will always be the last element. " +
            "`updates` is guaranteed to always contain at least one element."
    )
    val updates: List<JobUpdate>,

    val billing: JobBilling,

    @UCloudApiDoc(
        "The parameters used to launch this job.\n\n" +
            "This property is always available but must be explicitly requested."
    )
    val parameters: JobParameters,

    @UCloudApiDoc("A summary of the `Job`'s current status")
    val status: JobStatus,

    @UCloudApiDoc("Information regarding the output of this job.")
    val output: JobOutput? = null,
)

@UCloudApiExperimental(ExperimentalLevel.ALPHA)
data class JobStatus(
    @UCloudApiDoc(
        "The current of state of the `Job`.\n\n" +
            "This will match the latest state set in the `updates`"
    )
    val state: JobState,

    @UCloudApiDoc(
        "Timestamp matching when the `Job` most recently transitioned to the `RUNNING` state.\n\n" +
            "For `Job`s which suspend this might occur multiple times. This will always point to the latest point" +
            "in time it started running."
    )
    val startedAt: Long? = null,

    @UCloudApiDoc(
        "Timestamp matching when the `Job` is set to expire.\n\n" +
            "This is generally equal to `startedAt + timeAllocation`. Note that this field might be `null` if " +
            "the `Job` has no associated deadline. For `Job`s that suspend however, this is more likely to be" +
            "equal to the initial `RUNNING` state + `timeAllocation`."
    )
    val expiresAt: Long? = null
)

data class JobBilling(
    @UCloudApiDoc("The amount of credits charged to the `owner` of this job")
    val creditsCharged: Long,

    @UCloudApiDoc("The unit price of this job")
    val pricePerUnit: Long,
)

@UCloudApiExperimental(ExperimentalLevel.ALPHA)
data class JobOwner(
    @UCloudApiDoc("The username of the user which started the job")
    val launchedBy: String,

    @UCloudApiDoc(
        "The project ID of the project which owns this job\n\n" +
            "This value can be null and this signifies that the job belongs to the personal workspace of the user."
    )
    val project: String? = null,
)

data class JobUpdate(
    val timestamp: Long,
    val state: JobState? = null,
    val status: String? = null,
)

data class JobParameters(
    @UCloudApiDoc("A reference to the application which this job should execute")
    @JsonDeserialize(`as` = NameAndVersionImpl::class)
    val application: NameAndVersion,

    @UCloudApiDoc("A reference to the product that this job will be executed on")
    val product: ComputeProductReference,

    @UCloudApiDoc(
        "A name for this job assigned by the user.\n\n" +
            "The name can help a user identify why and with which parameters a job was started. " +
            "This value is suitable for display in user interfaces."
    )
    val name: String? = null,

    @UCloudApiDoc(
        "The number of replicas to start this job in\n\n" +
            "The `resources` supplied will be mounted in every replica. Some `resources` might only be supported in " +
            "an 'exclusive use' mode. This will cause the job to fail if `replicas != 1`."
    )
    val replicas: Int = 1,

    @UCloudApiDoc(
        "Allows the job to be started even when a job is running in an identical configuration\n\n" +
            "By default, UCloud will prevent you from accidentally starting two jobs with identical configuration. " +
            "This field must be set to `true` to allow you to create two jobs with identical configuration."
    )
    val allowDuplicateJob: Boolean = false,

    @UCloudApiDoc(
        "Parameters which are consumed by the job\n\n" +
            "The available parameters are defined by the `application`. " +
            "This attribute is not included by default unless `includeParameters` is specified."
    )
    val parameters: Map<String, AppParameterValue>? = null,

    @UCloudApiDoc(
        "Additional resources which are made available into the job\n\n" +
            "This attribute is not included by default unless `includeParameters` is specified. " +
            "Note: Not all resources can be attached to a job. UCloud supports the following parameter types as " +
            "resources:\n\n" +
            " - `file`\n" +
            " - `peer`\n" +
            " - `network`\n" +
            " - `block_storage`\n" +
            " - `ingress`\n"
    )
    val resources: List<AppParameterValue>? = null,

    @UCloudApiDoc(
        "Time allocation for the job\n\n" +
            "This value can be `null` which signifies that the job should not (automatically) expire. " +
            "Note that some providers do not support `null`. When this value is not `null` it means that the job " +
            "will be terminated, regardless of result, after the duration has expired. Some providers support " +
            "extended this duration via the `extend` operation."
    )
    val timeAllocation: SimpleDuration? = null,

    @UCloudApiDoc(
        "The resolved product referenced by `product`.\n\n" +
            "This attribute is not included by default unless `includeProduct` is specified."
    )
    val resolvedProduct: Product.Compute? = null,

    @UCloudApiDoc(
        "The resolved application referenced by `application`.\n\n" +
            "This attribute is not included by default unless `includeApplication` is specified."
    )
    val resolvedApplication: Application? = null,
) {
    init {
        if (name != null && !name.matches(nameRegex)) {
            throw RPCException(
                "Provided job name is invalid. It cannot contain any special characters",
                HttpStatusCode.BadRequest
            )
        }
    }

    companion object {
        private val nameRegex = Regex("""[\w _-]+""")
    }
}

typealias ComputeProductReference = ProductReference

data class JobOutput(
    val outputFolder: String,
)

interface JobDataIncludeFlags {
    @UCloudApiDoc("Includes `parameters.parameters` and `parameters.resources`")
    val includeParameters: Boolean?

    @UCloudApiDoc("Includes `updates`")
    val includeUpdates: Boolean?

    @UCloudApiDoc("Includes `parameters.resolvedApplication`")
    val includeApplication: Boolean?

    @UCloudApiDoc("Includes `parameters.resolvedProduct`")
    val includeProduct: Boolean?
}

interface JobFilters {
    val filterApplication: String?
    val filterLaunchedBy: String?
    val filterState: JobState?
    val filterTitle: String?
    val filterBefore: Long?
    val filterAfter: Long?
}

fun JobDataIncludeFlags(
    includeParameters: Boolean? = null,
    includeUpdates: Boolean? = null,
    includeApplication: Boolean? = null,
    includeProduct: Boolean? = null,
) = JobDataIncludeFlagsImpl(
    includeParameters,
    includeUpdates,
    includeApplication,
    includeProduct
)

data class JobDataIncludeFlagsImpl(
    override val includeParameters: Boolean? = null,
    override val includeUpdates: Boolean? = null,
    override val includeApplication: Boolean? = null,
    override val includeProduct: Boolean? = null,
) : JobDataIncludeFlags

typealias JobsCreateRequest = BulkRequest<JobParameters>

data class JobsCreateResponse(val ids: List<String>)

data class JobsRetrieveRequest(
    val id: String,
    override val includeParameters: Boolean? = null,
    override val includeUpdates: Boolean? = null,
    override val includeApplication: Boolean? = null,
    override val includeProduct: Boolean? = null,
) : JobDataIncludeFlags
typealias JobsRetrieveResponse = Job

data class JobsRetrieveUtilizationRequest(
    val provider: String?,
    val jobId: String?
) {
    init {
        if (jobId == null && provider == null) {
            throw RPCException("Must provide either provider or jobId", HttpStatusCode.BadRequest)
        }

        if (jobId != null && provider != null) {
            throw RPCException("Can only provide one of provider or jobId", HttpStatusCode.BadRequest)
        }
    }
}

data class JobsRetrieveUtilizationResponse(
    val capacity: CpuAndMemory,
    val usedCapacity: CpuAndMemory,
    val queueStatus: QueueStatus
)

data class JobsBrowseRequest(
    override val itemsPerPage: Int,
    override val next: String? = null,
    override val consistency: PaginationRequestV2Consistency? = null,
    override val itemsToSkip: Long? = null,
    override val includeParameters: Boolean? = null,
    override val includeUpdates: Boolean? = null,
    override val includeApplication: Boolean? = null,
    override val includeProduct: Boolean? = null,
    val sortBy: JobsSortBy? = null,
    override val filterApplication: String? = null,
    override val filterLaunchedBy: String? = null,
    override val filterState: JobState? = null,
    override val filterTitle: String? = null,
    override val filterBefore: Long? = null,
    override val filterAfter: Long? = null,
) : WithPaginationRequestV2, JobDataIncludeFlags, JobFilters
typealias JobsBrowseResponse = PageV2<Job>

enum class JobsSortBy {
    CREATED_AT,
    STATE,
    APPLICATION,
}

typealias JobsDeleteRequest = BulkRequest<FindByStringId>
typealias JobsDeleteResponse = Unit

typealias JobsFollowRequest = FindByStringId

data class JobsFollowResponse(
    val updates: List<JobUpdate>,
    val log: List<JobsLog>,
    val newStatus: JobStatus?
)

data class JobsLog(val rank: Int, val stdout: String?, val stderr: String?)

typealias JobsExtendRequest = BulkRequest<JobsExtendRequestItem>
typealias JobsExtendResponse = Unit

data class JobsExtendRequestItem(
    val jobId: String,
    val requestedTime: SimpleDuration,
)

typealias JobsSuspendRequest = BulkRequest<JobsSuspendRequestItem>
typealias JobsSuspendResponse = Unit
typealias JobsSuspendRequestItem = FindByStringId

val Job.files: List<AppParameterValue.File>
    get() {
        return (parameters.resources?.filterIsInstance<AppParameterValue.File>() ?: emptyList()) +
            (parameters.parameters?.values?.filterIsInstance<AppParameterValue.File>() ?: emptyList())
    }

val Job.peers: List<AppParameterValue.Peer>
    get() {
        return (parameters.resources?.filterIsInstance<AppParameterValue.Peer>() ?: emptyList()) +
            (parameters.parameters?.values?.filterIsInstance<AppParameterValue.Peer>() ?: emptyList())
    }

val Job.ingressPoints: List<AppParameterValue.Ingress>
    get() {
        return (parameters.resources?.filterIsInstance<AppParameterValue.Ingress>() ?: emptyList()) +
            (parameters.parameters?.values?.filterIsInstance<AppParameterValue.Ingress>() ?: emptyList())
    }

val Job.networks: List<AppParameterValue.Network>
    get() {
        return (parameters.resources?.filterIsInstance<AppParameterValue.Network>() ?: emptyList()) +
            (parameters.parameters?.values?.filterIsInstance<AppParameterValue.Network>() ?: emptyList())
    }

val Job.blockStorage: List<AppParameterValue.BlockStorage>
    get() {
        return (parameters.resources?.filterIsInstance<AppParameterValue.BlockStorage>() ?: emptyList()) +
            (parameters.parameters?.values?.filterIsInstance<AppParameterValue.BlockStorage>() ?: emptyList())
    }

val Job.currentState: JobState
    get() = updates.findLast { it.state != null }?.state ?: error("job contains no states")

typealias JobsOpenInteractiveSessionRequest = BulkRequest<JobsOpenInteractiveSessionRequestItem>

data class JobsOpenInteractiveSessionRequestItem(
    val id: String,
    val rank: Int,
    val sessionType: InteractiveSessionType,
)

data class JobsOpenInteractiveSessionResponse(val sessions: List<OpenSessionWithProvider>)

data class OpenSessionWithProvider(
    val providerDomain: String,
    val providerId: String,
    val session: OpenSession
)

@JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.PROPERTY,
    property = TYPE_PROPERTY
)
@JsonSubTypes(
    JsonSubTypes.Type(
        value = OpenSession.Shell::class,
        name = "shell"
    ),
    JsonSubTypes.Type(
        value = OpenSession.Web::class,
        name = "web"
    ),
    JsonSubTypes.Type(
        value = OpenSession.Vnc::class,
        name = "vnc"
    ),
)
sealed class OpenSession {
    abstract val jobId: String
    abstract val rank: Int

    data class Shell(
        override val jobId: String,
        override val rank: Int,
        val sessionIdentifier: String,
    ) : OpenSession()

    data class Web(
        override val jobId: String,
        override val rank: Int,
        val redirectClientTo: String,
    ) : OpenSession()

    data class Vnc(
        override val jobId: String,
        override val rank: Int,
        val url: String,
        val password: String? = null
    ) : OpenSession()
}

@UCloudApiExperimental(ExperimentalLevel.ALPHA)
object Jobs : CallDescriptionContainer("jobs") {
    const val baseContext = "/api/jobs"

    init {
        title = "Jobs"
        description = """
            This is a test description
        """.trimIndent()
    }

    val create = call<JobsCreateRequest, JobsCreateResponse, CommonErrorMessage>("create") {
        httpCreate(baseContext)

        documentation {
            summary = "Start a compute job"
        }
    }

    val delete = call<JobsDeleteRequest, JobsDeleteResponse, CommonErrorMessage>("delete") {
        httpDelete(baseContext)

        documentation {
            summary = "Request job cancellation and destruction"
            description = """
                This call will request the cancellation of the associated jobs. This will make sure that the jobs
                are eventually stopped and resources are released. If the job is running a virtual machine, then the
                virtual machine will be stopped and destroyed. Persistent storage attached to the job will not be
                deleted only temporary data from the job will be deleted.
                
                This call is asynchronous and the cancellation may not be immediately visible in the job. Progress can
                be followed using the ${docCallRef(::retrieve)}, ${docCallRef(::browse)}, ${docCallRef(::follow)} calls.
            """.trimIndent()
        }
    }

    val retrieve = call<JobsRetrieveRequest, JobsRetrieveResponse, CommonErrorMessage>("retrieve") {
        httpRetrieve(baseContext)

        documentation {
            summary = "Retrieve a single Job"
        }
    }

    val retrieveUtilization = call<JobsRetrieveUtilizationRequest, JobsRetrieveUtilizationResponse, CommonErrorMessage>(
        "retrieveUtilization"
    ) {
        httpRetrieve(baseContext, "utilization")

        documentation {
            summary = "Retrieve utilization information from cluster"
        }
    }

    val browse = call<JobsBrowseRequest, JobsBrowseResponse, CommonErrorMessage>("browse") {
        httpBrowse(baseContext)

        documentation {
            summary = "Browse the jobs available to this user"
        }
    }

    val follow = call<JobsFollowRequest, JobsFollowResponse, CommonErrorMessage>("follow") {
        auth { access = AccessRight.READ }
        websocket(baseContext)

        documentation {
            summary = "Follow the progress of a job"
        }
    }

    val extend = call<JobsExtendRequest, JobsExtendResponse, CommonErrorMessage>("extend") {
        httpUpdate(baseContext, "extend")

        documentation {
            summary = "Extend the duration of one or more jobs"
            description = """
                This will extend the duration of one or more jobs in a bulk request. Extension of a job will add to
                the current deadline of a job. Note that not all providers support this features. Providers which
                do not support it will have it listed in their manifest. If a provider is asked to extend a deadline
                when not supported it will send back a 400 bad request.
                
                This call makes no guarantee that all jobs are extended in a single transaction. If the provider
                supports it, then all requests made against a single provider should be made in a single transaction.
                Clients can determine if their extension request against a specific target was successful by checking
                if the time remaining of the job has been updated.
                
                This call will return 2XX if all jobs have successfully been extended. The job will fail with a
                status code from the provider one the first extension which fails. UCloud will not attempt to extend
                more jobs after the first failure.
            """.trimIndent()
        }
    }

    val suspend = call<JobsSuspendRequest, JobsSuspendResponse, CommonErrorMessage>("suspend") {
        httpUpdate(baseContext, "suspend")

        documentation {
            summary = "Suspend a job"
            description = """
                Suspends the job, putting it in a paused state. Not all compute backends support this operation.
                For compute backends which deals with Virtual Machines this will shutdown the Virtual Machine
                without deleting any data.
            """.trimIndent()
        }
    }

    val openInteractiveSession = call<JobsOpenInteractiveSessionRequest, JobsOpenInteractiveSessionResponse,
        CommonErrorMessage>("openInteractiveSession") {
        httpUpdate(baseContext, "interactiveSession")
    }
}
