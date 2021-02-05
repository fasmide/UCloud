package dk.sdu.cloud.app.kubernetes

import dk.sdu.cloud.app.kubernetes.api.AppKubernetesServiceDescription
import dk.sdu.cloud.auth.api.AuthenticatorFeature
import dk.sdu.cloud.micro.*
import dk.sdu.cloud.service.CommonServer

data class TolerationKeyAndValue(val key: String, val value: String)

data class Configuration(
    val cookieName: String = "appRefreshToken",
    val prefix: String = "app-",
    val domain: String = "cloud.sdu.dk",
    val performAuthentication: Boolean = true,
    val toleration: TolerationKeyAndValue? = null,
    val reloadableK8Config: String? = null,
    val disableMasterElection: Boolean = false,
    val fullScanFrequency: Long = 1000 * 60 * 15L,
    val useSmallReservation: Boolean = false,
)

data class CephConfiguration(
    val subfolder: String = ""
)

object AppKubernetesService : Service {
    override val description = AppKubernetesServiceDescription

    override fun initializeServer(micro: Micro): CommonServer {
        micro.install(AuthenticatorFeature)
        micro.install(BackgroundScopeFeature)
        val configuration = micro.configuration.requestChunkAtOrNull("app", "kubernetes") ?: Configuration()
        val cephConfig = micro.configuration.requestChunkAtOrNull("ceph") ?: CephConfiguration()

        return Server(micro, configuration, cephConfig)
    }
}

fun main(args: Array<String>) {
    AppKubernetesService.runAsStandalone(args)
}
