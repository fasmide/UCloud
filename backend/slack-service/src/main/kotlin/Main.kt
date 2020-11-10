package dk.sdu.cloud.slack

import dk.sdu.cloud.micro.*
import dk.sdu.cloud.auth.api.RefreshingJWTCloudFeature
import dk.sdu.cloud.service.CommonServer
import dk.sdu.cloud.slack.api.SlackServiceDescription


data class Configuration (
    val notifiers: Notifiers = Notifiers()
)

data class Notifiers(
    val slack: SlackNotifierConfig? = null
)

data class SlackNotifierConfig(
    val hook: String
)

object SlackService : Service {
    override val description = SlackServiceDescription
    
    override fun initializeServer(micro: Micro): CommonServer {
        micro.install(RefreshingJWTCloudFeature)
        val configuration = micro.configuration.requestChunkAt<Configuration>("alerting")
        return Server(micro, configuration)
    }
}

fun main(args: Array<String>) {
    SlackService.runAsStandalone(args)
}
