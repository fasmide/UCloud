package dk.sdu.cloud

import dk.sdu.cloud.accounting.api.*
import dk.sdu.cloud.auth.api.*
import dk.sdu.cloud.http.RpcServer
import dk.sdu.cloud.calls.client.*
import dk.sdu.cloud.calls.bulkRequestOf
import dk.sdu.cloud.config.*
import dk.sdu.cloud.controllers.EnvoyConfigurationService
import dk.sdu.cloud.controllers.UCLOUD_IM_PORT
import dk.sdu.cloud.http.OutgoingCallResponse
import dk.sdu.cloud.http.OutgoingHttpCall
import dk.sdu.cloud.http.OutgoingHttpRequestInterceptor
import dk.sdu.cloud.provider.api.*
import dk.sdu.cloud.service.LogLevel
import dk.sdu.cloud.service.currentLogLevel
import dk.sdu.cloud.utils.*
import kotlinx.serialization.encodeToString
import kotlinx.cinterop.*
import platform.posix.*
import kotlin.native.concurrent.TransferMode
import kotlin.native.concurrent.Worker
import kotlin.system.exitProcess

fun runInstaller(
    ownExecutable: String,
) {
    val isInComposeDev: Boolean = run {
        val hasBackend = verifyHost(Host("backend", "http", 8080)) is VerifyResult.Ok<*>
        val hasFrontend = verifyHost(Host("frontend", "http", 9000)) is VerifyResult.Ok<*>

        hasBackend && hasFrontend
    }

    if (isInComposeDev) {
        sendTerminalMessage {
            bold { blue { line("Welcome to the UCloud/IM installer.") } }
            code { inline("./launcher") }
            line(" usage detected!")
            line()
            line("This installation process will register the integration module with the UCloud/Core instance.")
            line()
        }

        val rpcClient = RpcClient()
        OutgoingHttpRequestInterceptor().also {
            it.install(rpcClient, FixedOutgoingHostResolver(HostInfo("backend", "http", 8080)))
        }

        val authenticatedClient = AuthenticatedClient(rpcClient, OutgoingHttpCall) {}

        val providerId = getenv("UCLOUD_PROVIDER_ID")?.toKString() ?: "development"
        val port = 8889
        val result = try {
            Providers.requestApproval.callBlocking(
                ProvidersRequestApprovalRequest.Information(
                    ProviderSpecification(
                        providerId,
                        "integration-module",
                        false,
                        port
                    )
                ),
                authenticatedClient
            ).orThrow()
        } catch (ex: Throwable) {
            val path = "/tmp/ucloud-im-error.log"
            sendTerminalMessage {
                bold { red { line("UCloud/IM could not connect to UCloud/Core!") } }
                line("Please make sure that the backend is running (see output of ./launcher for more information)")
                line()
                line("Error log written to: $path")
            }
            
            runCatching {
                NativeFile.open(path, readOnly = false).writeText(ex.stackTraceToString())
            }

            exitProcess(1)
        }

        val token = when (result) {
            is ProvidersRequestApprovalResponse.RequiresSignature -> result.token
            is ProvidersRequestApprovalResponse.AwaitingAdministratorApproval -> result.token
        }

        sendTerminalMessage {
            bold { green { line("UCloud/IM has registered with UCloud/Core.") } }
            line()
            line("Please finish the configuration by approving the connection here:")
            code { line("http://localhost:9000/app/admin/providers/register?token=$token") }
            line()
            bold { blue { line("Awaiting response from UCloud/Core. Please keep UCloud/IM running!") } }
        }

        currentLogLevel = LogLevel.INFO
        val envoy = EnvoyConfigurationService(ENVOY_CONFIG_PATH)
        val server = RpcServer(UCLOUD_IM_PORT, showWelcomeMessage = false)

        val ip = IntegrationProvider(providerId)
        server.implement(ip.welcome) {
            currentLogLevel = LogLevel.INFO

            NativeFile.open(
                "/etc/ucloud/core.yaml",
                readOnly = false,
                truncateIfNeeded = true,
                mode = "644".toInt(8)
            ).writeText(
                """
                    providerId: $providerId

                    hosts:
                        self:
                            host: integration-module
                            scheme: http
                            port: 8889

                        ucloud:
                            host: backend
                            scheme: http
                            port: 8080

                """.trimIndent()
            )

            NativeFile.open(
                "/etc/ucloud/ucloud_crt.pem",
                readOnly = false,
                truncateIfNeeded = true,
                mode = "644".toInt(8)
            ).writeText(request.createdProvider.publicKey)

            NativeFile.open(
                "/etc/ucloud/server.yaml",
                readOnly = false,
                truncateIfNeeded = true,
                mode = "600".toInt(8)
            ).writeText(
                """
                    refreshToken: ${request.createdProvider.refreshToken}
                """.trimIndent()
            )

            NativeFile.open(
                "/etc/ucloud/plugins.yaml",
                readOnly = false,
                truncateIfNeeded = true,
                mode = "660".toInt(8)
            ).writeText(
                """
                    connection:
                        # Specifies the plugin type. The remaining configuration is specific to this plugin.
                        type: OpenIdConnect

                        # Certificate used for verifying OIDC tokens.
                        certificate: MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkywzuw1vysFj2iAyEarB9TiNv8btUlbENPMNlyC2/kFHurCzq/5ilbWmbhqhxFdGXVoXvxmh1XirODAjcb2wRgCDNk1O8cDdygG4d7xOihdKxey/U8m/3rZelgQ+O4HjcXAslW4vKY6RTCIbXNEjSKD43Av7UDby7U45G1ibWnhagJCz/5kNjp1YNUHiDqP+v105z6OxOPZgKfXrZKGcIMsQFyOsKvFcYGxd0p/aTfwcN/5M1exXa5kxU5B469dDjGWcypqWJ+iLTdCyHehe4AJZoL2PK5Uh5qIdGnbdoY+T5d7hQz6MIgUDRfaIVD1Sik6J/dRLcXwY2AT6C3SY8QIDAQAB

                        # Determines for how long we should consider the connection valid. Once the time-to-live has expired, the user
                        # must reestablish the connection.
                        mappingTimeToLive:
                            days: 7

                        # Endpoints used in the OIDC protocol.
                        endpoints:
                            auth: http://localhost:61241/realms/master/protocol/openid-connect/auth
                            token: http://keycloak:8080/realms/master/protocol/openid-connect/token

                        # Client information used in the OIDC protocol.
                        client:
                            id: im-client-id
                            secret: 52VsKbfcC1zHcCDarNRJQGFawhqZUk7i

                        # Extensions which will be invoked by the plugin when certain events occur.
                        extensions:
                            # Invoked when the connection has completed.
                            onConnectionComplete: /opt/ucloud/example-extensions/oidc-extension
                        redirectUrl: localhost:8080

                    projects:
                        type: Simple
                        
                        unixGroupNamespace: 1000
                        extensions:
                            all: /opt/ucloud/example-extensions/project-extension

                    jobs:
                        default:
                            type: Slurm
                            matches: im-cpu
                            partition: normal
                            mountpoint: /data
                            useFakeMemoryAllocations: true

                    files:
                        default:
                            type: Posix
                            matches: im-storage

                    fileCollections:
                        default:
                            type: Posix
                            matches: im-storage
                            
                            simpleHomeMapper:
                            - title: Home
                              prefix: /home
                """.trimIndent()
            )

            NativeFile.open(
                "/etc/ucloud/products.yaml",
                readOnly = false,
                truncateIfNeeded = true,
                mode = "660".toInt(8)
            ).writeText(
                """
                    compute:
                        im-cpu:
                        - im-cpu-1

                    storage:
                        im-storage:
                        - im-storage
                """.trimIndent()
            )

            data class ShutdownArgs(
                val ownExecutable: String,
                val refreshToken: String,
                val providerId: String
            )
            Worker.start(name = "Shutting down")
                .execute(TransferMode.SAFE, {
                    ShutdownArgs(ownExecutable, request.createdProvider.refreshToken, providerId)
                }) {
                    runShutdownWorker(it.ownExecutable, it.refreshToken, it.providerId)
                }

            OutgoingCallResponse.Ok(IntegrationProviderWelcomeResponse)
        }

        envoy.start(port)
        server.start()
    }
}

private fun runShutdownWorker(
    ownExecutable: String,
    refreshToken: String,
    providerId: String
) {
    sleep(1)
    val rpcClient = RpcClient()
    OutgoingHttpRequestInterceptor().also {
        it.install(rpcClient, FixedOutgoingHostResolver(HostInfo("backend", "http", 8080)))
    }

    val authenticateClient = RefreshingJWTAuthenticator(
        rpcClient,
        JwtRefresher.Provider(refreshToken, OutgoingHttpCall),
        becomesInvalidSoon = { true }
    ).authenticateClient(OutgoingHttpCall)

    @Suppress("UNCHECKED_CAST")
    Products.create.callBlocking(
        bulkRequestOf(
            Product.Compute(
                name = "im-cpu-1",
                pricePerUnit = 1000L,
                category = ProductCategoryId("im-cpu", providerId),
                description = "Example product",
                cpu = 1,
                memoryInGigs = 1,
                gpu = 0,
            ),

            Product.Storage(
                name = "im-storage",
                pricePerUnit = 1L,
                category = ProductCategoryId("im-storage", providerId),
                description = "Example product",
                unitOfPrice = ProductPriceUnit.PER_UNIT,
                chargeType = ChargeType.DIFFERENTIAL_QUOTA,
            )
        ),
        authenticateClient
    ).orThrow()

    sendTerminalMessage {
        bold { green { line("UCloud/IM has been configured successfully. UCloud/IM will now restart...") } }
    }

    replaceThisProcess(listOf(ownExecutable, "server"), ProcessStreams())
}

