package dk.sdu.cloud.config

import dk.sdu.cloud.ProductReferenceWithoutProvider
import dk.sdu.cloud.ServerMode
import dk.sdu.cloud.file.orchestrator.api.FileType
import dk.sdu.cloud.plugins.*
import dk.sdu.cloud.utils.*
import kotlin.system.exitProcess
import kotlinx.cinterop.*
import platform.posix.*

// NOTE(Dan): To understand how this class is loaded, see the note in `Config.kt` of this package.

data class VerifiedConfig(
    val serverMode: ServerMode,
    val coreOrNull: Core?,
    val serverOrNull: Server?,
    val pluginsOrNull: Plugins?,
    val productsOrNull: Products?,
    val frontendProxyOrNull: FrontendProxy?
) {
    val core: Core get() = coreOrNull!!
    val server: Server get() = serverOrNull!!
    val plugins: Plugins get() = pluginsOrNull!!
    val products: Products get() = productsOrNull!!
    val frontendProxy: FrontendProxy get() = frontendProxyOrNull!!

    data class Core(
        val providerId: String,
        val hosts: Hosts,
        val ipc: Ipc,
        val logs: Logs,
    ) {
        data class Hosts(
            val ucloud: Host,
            val self: Host?,
        )

        data class Ipc(
            val directory: String
        )

        data class Logs(
            val directory: String
        )
    }

    data class Server(
        val certificate: String,
        val refreshToken: String,
        val network: Network,
        val developmentMode: DevelopmentMode,
        val database: Database,
    ) {
        data class Network(
            val listenAddress: String,
            val listenPort: Int
        )

        data class DevelopmentMode(
            val predefinedUserInstances: List<UserInstance>
        ) {
            data class UserInstance(
                val username: String,
                val userId: Int,
                val port: Int
            )
        }

        data class Database(
            val file: String,
        )
    }

    data class Plugins(
        val connection: ConnectionPlugin?,
        val projects: ProjectPlugin?,
        val jobs: Map<String, ComputePlugin>,
        val files: Map<String, FilePlugin>,
        val fileCollections: Map<String, FileCollectionPlugin>
    ) {
        interface ProductBased {
            val matches: ProductMatcher
        }

        sealed class ProductMatcher {
            abstract fun match(product: ProductReferenceWithoutProvider): Int

            data class Product(val category: String, val id: String) : ProductMatcher() {
                override fun match(product: ProductReferenceWithoutProvider): Int {
                    return if (product.category == category && product.id == id) {
                        3
                    } else {
                        -1
                    }
                }
            }

            data class Category(val category: String) : ProductMatcher() {
                override fun match(product: ProductReferenceWithoutProvider): Int {
                    return if (product.category == category) 2
                    else -1
                }
            }

            object Any : ProductMatcher() {
                override fun match(product: ProductReferenceWithoutProvider): Int = 1
            }

            companion object {
                fun parse(pattern: String): VerifyResult<ProductMatcher> {
                    val trimmed = pattern.trim()

                    if (trimmed.contains("\n")) {
                        return VerifyResult.Error("Product matcher cannot contain new lines.")
                    }

                    if (trimmed == "*") return VerifyResult.Ok(Any)

                    return if (trimmed.contains("/")) {
                        val category = trimmed.substringBefore('/').trim()
                        val id = trimmed.substringAfter('/').trim()

                        if (id.contains("/")) {
                            return VerifyResult.Error("Product matcher contains too many slashes.")
                        }

                        VerifyResult.Ok(Product(category, id))
                    } else {
                        VerifyResult.Ok(Category(trimmed))
                    }
                }
            }
        }
    }

    data class Products(
        val compute: Map<String, List<String>>? = null,
        val storage: Map<String, List<String>>? = null,
    )

    data class FrontendProxy(
        val sharedSecret: String,
        val remote: Host
    )
}

// NOTE(Dan): Make sure you understand `loadConfiguration()` of `Config.kt` before you read this function. This
// function takes, as input the output of `loadConfiguration()`. The job is then to read the raw configuration from
// the user, and determine if it is valid and fetch additional information if required. This usually involves checking
// if additional files exists, making sure hosts are valid and so on. Once this function is done, then the
// configuration should be valid and no plugins/other code should crash as a result of bad configuration.
fun verifyConfiguration(mode: ServerMode, config: ConfigSchema): VerifiedConfig {
    run {
        // Verify that sections required by the mode are available.

        if (config.core == null) missingFile(config, ConfigSchema.FILE_CORE) // Required for all

        when (mode) {
            ServerMode.FrontendProxy -> {
                if (config.frontendProxy == null) missingFile(config, ConfigSchema.FILE_FRONTEND_PROXY)
                if (config.server != null) insecureFile(config, ConfigSchema.FILE_SERVER)
            }

            is ServerMode.Plugin -> {
                // No validation required
            }

            ServerMode.Server -> {
                if (config.plugins == null) missingFile(config, ConfigSchema.FILE_PLUGINS)
                if (config.server == null) missingFile(config, ConfigSchema.FILE_SERVER)
                if (config.products == null) missingFile(config, ConfigSchema.FILE_PRODUCTS)
            }

            ServerMode.User -> {
                if (config.server != null) insecureFile(config, ConfigSchema.FILE_SERVER)
                if (config.plugins == null) missingFile(config, ConfigSchema.FILE_PLUGINS)
                if (config.products == null) missingFile(config, ConfigSchema.FILE_PRODUCTS)
                if (config.frontendProxy != null) insecureFile(config, ConfigSchema.FILE_FRONTEND_PROXY)
            }
        }
    }

    val core: VerifiedConfig.Core = run {
        // Verify the core section
        val core = config.core!!
        val baseReference = ConfigurationReference(
            config.configurationDirectory + "/" + ConfigSchema.FILE_CORE, 
            core.yamlDocument, 
            YamlLocationReference(0, 0),
        )

        // NOTE(Dan): Provider ID is verified later together with products
        val providerId = core.providerId

        val hosts = run {
            val ucloud = handleVerificationResultStrict(verifyHost(
                core.hosts.ucloud, 
                baseReference.useLocationAndProperty(core.hosts.ucloud.tag, "hosts/ucloud")
            ))
            val self = if (core.hosts.self != null) {
                handleVerificationResultWeak(verifyHost(
                    core.hosts.self,
                    baseReference.useLocationAndProperty(core.hosts.self.tag, "hosts/self")
                )) ?: core.hosts.self
            } else {
                null
            }

            VerifiedConfig.Core.Hosts(ucloud, self)
        }

        val ipc = run {
            val directory = handleVerificationResultStrict(
                verifyFile(
                    core.ipc?.directory ?: "/var/run/ucloud", 
                    FileType.DIRECTORY,
                    baseReference.useLocationAndProperty(core.ipc?.tag, "ipc/directory")
                )
            )

            VerifiedConfig.Core.Ipc(directory)
        }

        val logs = run {
            val directory = handleVerificationResultStrict(
                verifyFile(
                    core.logs?.directory ?: "/var/log/ucloud", 
                    FileType.DIRECTORY,
                    baseReference.useLocationAndProperty(core.logs?.tag, property = "logs/directory")
                )
            )

            VerifiedConfig.Core.Logs(directory)
        }

        VerifiedConfig.Core(providerId, hosts, ipc, logs)
    }

    val server: VerifiedConfig.Server? = if (config.server == null) {
        null
    } else {
        val baseReference = ConfigurationReference(
            config.configurationDirectory + "/" + ConfigSchema.FILE_SERVER, 
            config.server.yamlDocument, 
            YamlLocationReference(0, 0),
        )

        val refreshToken = run {
            val tok = config.server.refreshToken.value.trim()

            if (tok.isBlank() || tok.length < 10 || tok.contains("\n")) {
                emitError(
                    VerifyResult.Error<Unit>(
                        "The refresh token supplied for the server does not look valid.",
                        baseReference.useLocationAndProperty(config.server.refreshToken.tag, "refreshToken")
                    )
                )
            }

            tok
        }

        val certificate = run {
            val certPath = "${config.configurationDirectory}/ucloud_crt.pem"
            try {
                val certText = normalizeCertificate(NativeFile.open(certPath, readOnly = true).readText())

                val lineRegex = Regex("[a-zA-Z0-9+/=,-_]+")
                certText.lines().drop(1).dropLast(1).forEach { line ->
                    if (!line.matches(lineRegex)) {
                        error("Invalid certificate")
                    }
                }

                certText
            } catch (ex: Throwable) {
                sendTerminalMessage {
                    red { bold { line("Configuration error!") } }
                    line("Could not load certificate used for authentication with UCloud.")
                    line()

                    inline("We expected to be able to find the certificate here: ")
                    code { line(certPath) }
                    line()

                    line("The ceritificate is issued by UCloud during the registration process. " +
                        "You can try downloading a new certificate from UCloud at: ")
                    code { line("${core.hosts.ucloud}/app/providers") }
                }
                exitProcess(1)
            }
        }

        val network: VerifiedConfig.Server.Network = run {
            VerifiedConfig.Server.Network(
                config.server.network?.listenAddress ?: "127.0.0.1",
                config.server.network?.listenPort ?: 8889
            )
        }

        run {
            if (!network.listenAddress.matches(Regex("""\d\d?\d?\.\d\d?\d?\.\d\d?\d?\.\d\d?\d?"""))) {
                emitWarning(
                    VerifyResult.Warning<Unit>(
                        "The listen address specified for the server '${network.listenAddress}' does not look " +
                            "like a valid IPv4 address. The integration module will attempt to use this address " + 
                            "regardless.",
                        baseReference.useLocationAndProperty(config.server.network?.tag, "network/listenAddress")
                    )
                )
            }
            if (network.listenPort <= 0 || network.listenPort >= 65536) {
                emitError(
                    VerifyResult.Error<Unit>(
                        "The listen port specified for the server '${network.listenPort}' is not valid.",
                        baseReference.useLocationAndProperty(config.server.network?.tag, "network/listenPort")
                    )
                )
            }
        }

        val developmentMode: VerifiedConfig.Server.DevelopmentMode = run {
            if (config.server.developmentMode == null) {
                VerifiedConfig.Server.DevelopmentMode(emptyList())
            } else {
                val portsInUse = HashSet<Int>()
                val usernamesInUse = HashSet<String>()

                val instances = config.server.developmentMode.predefinedUserInstances.mapIndexed { idx, instance ->
                    val username = instance.username.trim()
                    val userId = instance.userId
                    val port = instance.port

                    val path = "server/developmentMode/predefinedUserInstances[$idx]"
                    val ref = baseReference.useLocationAndProperty(instance.tag, path)

                    if (username.isBlank()) emitError("Username cannot be blank", ref)
                    if (username.contains("\n")) emitError("Username cannot contain newlines", ref)
                    if (username in usernamesInUse) {
                        emitError("Username '$username' is already in use by a different instance.", ref)
                    }

                    if (userId < 0) emitError("Invalid unix user id (UID)", ref)
                    if (userId == 0) emitError("Invalid unix user id (UID). It is not possible " +
                        "to run the integration module as root.", ref)

                    if (port in portsInUse) {
                        emitError("Port $port is already in use by a different instance.", ref)
                    }

                    if (port == network.listenPort) {
                        emitError("Development instance is using the same port as the server itself ($port).", ref)
                    }

                    if (port <= 0 || port >= 65536) {
                        emitError("Invalid port specified ($port).", ref)
                    }

                    portsInUse.add(port)
                    usernamesInUse.add(username)

                    VerifiedConfig.Server.DevelopmentMode.UserInstance(username, userId, port)
                }

                VerifiedConfig.Server.DevelopmentMode(instances)
            }
        }

        val database: VerifiedConfig.Server.Database = run {
            VerifiedConfig.Server.Database(config.configurationDirectory + "/ucloud.sqlite3")
        }

        VerifiedConfig.Server(certificate, refreshToken, network, developmentMode, database)
    }

    val products: VerifiedConfig.Products? = run {
        if (config.products == null) {
            null
        } else {
            // NOTE(Dan): Products are verified later (against UCloud/Core)
            VerifiedConfig.Products(
                config.products.compute?.mapValues { (_, v) -> v.map { it.value } }, 
                config.products.storage?.mapValues { (_, v) -> v.map { it.value } }
            )
        }
    }

    val frontendProxy: VerifiedConfig.FrontendProxy? = run {
        if (config.frontendProxy == null) {
            null
        } else {
            val baseReference = ConfigurationReference(
                config.configurationDirectory + "/" + ConfigSchema.FILE_FRONTEND_PROXY, 
                config.frontendProxy.yamlDocument,
                YamlLocationReference(0, 0),
            )

            val remote = if (mode == ServerMode.FrontendProxy) {
                handleVerificationResultStrict(verifyHost(
                    config.frontendProxy.remote,
                    baseReference.useLocationAndProperty(config.frontendProxy.remote.tag, "remote")
                ))
            } else {
                handleVerificationResultWeak(verifyHost(
                    config.frontendProxy.remote,
                    baseReference.useLocationAndProperty(config.frontendProxy.remote.tag, "remote")
                )) ?: config.frontendProxy.remote
            }

            val sharedSecret = config.frontendProxy.sharedSecret.trim()
            if (sharedSecret.isBlank() || sharedSecret.contains("\n")) {
                emitError(
                    "Shared secret for frontend proxy is not valid.",
                    baseReference.useLocationAndProperty(null, "sharedSecret")
                )
            }

            VerifiedConfig.FrontendProxy(sharedSecret, remote)
        }
    }

    val plugins: VerifiedConfig.Plugins? = run {
        if (config.plugins == null) {
            null
        } else {
            val productReference = ConfigurationReference(
                config.configurationDirectory + "/" + ConfigSchema.FILE_PRODUCTS, 
                config.products?.yamlDocument ?: "",
                YamlLocationReference(0, 0),
            )

            val pluginReference = ConfigurationReference(
                config.configurationDirectory + "/" + ConfigSchema.FILE_PLUGINS, 
                config.plugins.yamlDocument,
                YamlLocationReference(0, 0),
            )

            val connection: ConnectionPlugin? = if (config.plugins.connection == null) {
                null
            } else {
                loadPlugin(config.plugins.connection) as ConnectionPlugin
            }

            val projects: ProjectPlugin? = if (config.plugins.projects == null) {
                null
            } else {
                loadPlugin(config.plugins.projects) as ProjectPlugin
            }

            val jobs: Map<String, ComputePlugin> = loadProductBasedPlugins(
                config.products?.compute ?: emptyMap(),
                config.plugins.jobs ?: emptyMap(),
                productReference.useLocationAndProperty(null, "compute"),
                pluginReference.useLocationAndProperty(null, "jobs")
            ) as Map<String, ComputePlugin>

            val files: Map<String, FilePlugin> = loadProductBasedPlugins(
                config.products?.storage ?: emptyMap(),
                config.plugins.files ?: emptyMap(),
                productReference.useLocationAndProperty(null, "storage"),
                pluginReference.useLocationAndProperty(null, "files")
            ) as Map<String, FilePlugin>

            val fileCollections: Map<String, FileCollectionPlugin> = loadProductBasedPlugins(
                config.products?.storage ?: emptyMap(),
                config.plugins.fileCollections ?: emptyMap(),
                productReference.useLocationAndProperty(null, "storage"),
                pluginReference.useLocationAndProperty(null, "fileCollections")
            ) as Map<String, FileCollectionPlugin>

            VerifiedConfig.Plugins(connection, projects, jobs, files, fileCollections)
        }
    }

    return VerifiedConfig(mode, core, server, plugins, products, frontendProxy)
}

// Plugin loading
private fun <Cfg : Any> loadPlugin(config: Cfg): Plugin<Cfg> {
    val result = instansiatePlugin(config)
    result.configure(config)
    return result
}

private fun <Cfg : ConfigSchema.Plugins.ProductBased> loadProductBasedPlugins(
    products: Map<String, List<YamlString>>,
    plugins: Map<YamlString, Cfg>,
    productRef: ConfigurationReference,
    pluginRef: ConfigurationReference
): Map<String, Plugin<Cfg>> {
    val result = HashMap<String, Plugin<Cfg>>()
    val relevantProducts = products.entries.flatMap { (category, products) ->
        products.map { Pair(ProductReferenceWithoutProvider(it.value, category), it.tag) }
    }

    val partitionedProducts = HashMap<String, List<ProductReferenceWithoutProvider>>()
    for ((product, productTag) in relevantProducts) {
        var bestScore = -1
        var bestMatch: String? = null
        for ((id, pluginConfig) in plugins) {
            val matcher = handleVerificationResultStrict(
                VerifiedConfig.Plugins.ProductMatcher.parse(pluginConfig.matches)
            )

            val score = matcher.match(product)
            if (score == bestScore && score >= 0 && bestMatch != null) {
                emitError(
                    "Could not allocate product '$product' to a plugin. Both '$id' and '$bestMatch' " +
                        "target the product with identical specificity. Resolve this conflict by " +
                        "creating a more specific matcher.",
                    pluginRef
                )
            }

            if (score > bestScore) {
                bestScore = score
                bestMatch = id.value
            }
        }

        if (bestMatch == null) {
            emitWarning(
                "Could not allocate product '$product' to a plugin. No plugins match it, " +
                    "the integration module will ignore all requests for this product!",
                    productRef.useLocationAndProperty(
                        productTag, 
                        (productRef.property ?: "") + "/" + product.category + "/" + product.id
                    )
            )
        } else {
            partitionedProducts[bestMatch] = (partitionedProducts[bestMatch] ?: emptyList()) + product
        }
    }

    for ((id, pluginConfig) in plugins) {
        val products = partitionedProducts[id.value] ?: emptyList()
        val plugin = instansiatePlugin(pluginConfig)
        if (plugin is ResourcePlugin<*, *, *, *>) {
            plugin.pluginName = id.value
            plugin.productAllocation = products
            if (products.isEmpty()) {
                emitWarning(
                    "Could not allocate any products to the plugin '$id'. This plugin will never run!",
                    pluginRef.useLocationAndProperty(id.tag, (pluginRef.property ?: "") + "/" + id.value)
                )
            }
        }
        plugin.configure(pluginConfig)
        result[id.value] = plugin
    }

    return result
}

// End-user feedback
private fun missingFile(config: ConfigSchema, file: String): Nothing {
    sendTerminalMessage {
        bold { red { inline("Missing file! ") } }
        code { 
            inline(config.configurationDirectory)
            inline("/")
            line(file) 
        }
        line()
        line("This file is required when running the ingration module in this mode. Please make sure that the file ")
        line("exists and is readable by the appropiate users. We refer to the documentation for more information.")

        line()
        bold { inline("NOTE: ") }
        line("The integration module requires precise file names and extensions. Make sure the file exists exactly " +
            "as specified above")

    }
    exitProcess(1)
}

private fun insecureFile(config: ConfigSchema, file: String): Nothing {
    sendTerminalMessage {
        bold { red { inline("Insecure file! ") } }
        code { 
            inline(config.configurationDirectory)
            inline("/")
            line(file) 
        }
        line()
        line("This file is not supposed to be readable in the configuration, yet it was. ")
        line("We refer to the documentation for more information about this error.")
    }

    exitProcess(1)
}

private fun emitWarning(warning: String, ref: ConfigurationReference? = null) {
    emitWarning(VerifyResult.Warning<Unit>(warning, ref))
}

private fun emitWarning(result: VerifyResult.Warning<*>) {
    sendTerminalMessage {
        yellow { bold { inline("Configuration warning! ") } } 
        if (result.ref != null) code { line(result.ref.file) }

        line(result.message)
        line()
        
        if (result.ref?.location != null) {
            inline("The warning occured approximately here")
        } else if (result.ref?.property != null) {
            inline("The warning occured")
        }

        if (result.ref?.property != null) {
            inline(" in property ")
            code { inline(result.ref.property) }
        }

        if (result.ref?.location != null) {
            line(":")
            yamlDocumentContext(result.ref.document, result.ref.location.approximateStart,
                result.ref.location.approximateEnd)
        } else {
            line()
        }
    }
}

private fun emitError(error: String, ref: ConfigurationReference? = null): Nothing {
    emitError(VerifyResult.Error<Unit>(error, ref))
}

private fun emitError(result: VerifyResult.Error<*>): Nothing {
    sendTerminalMessage {
        red { bold { inline("Configuration error! ") } } 
        if (result.ref != null) code { line(result.ref.file) }

        line(result.message)
        line()
        
        if (result.ref?.location != null) {
            inline("The error occured approximately here")
        } else if (result.ref?.property != null) {
            inline("The error occured")
        }

        if (result.ref?.property != null) {
            inline(" in property ")
            code { inline(result.ref.property) }
        }

        if (result.ref?.location != null) {
            line(":")
            yamlDocumentContext(result.ref.document, result.ref.location.approximateStart,
                result.ref.location.approximateEnd)
        } else {
            line()
        }

        if (result.ref?.location?.approximateStart == 0 && result.ref?.location?.approximateEnd == 0) {
            line()
            line("The above value was computed value/default value. You can try specifying the value explicitly " +
                "in the configuration.")
        }
    }
    exitProcess(1)
}

// General verification procedures
data class ConfigurationReference(
    val file: String, 
    val document: String, 
    // NOTE(Dan): A value of null or (0, 0) indicates that this value was comptued
    val location: YamlLocationReference?,
    val property: String? = null,
) {
    fun useLocation(tag: YamlLocationTag?): ConfigurationReference {
        return if (tag == null) this
        else copy(location = tag.toReference())
    }

    fun useLocationAndProperty(tag: YamlLocationTag?, property: String): ConfigurationReference {
        return useLocation(tag).copy(property = property)
    }
}

sealed class VerifyResult<T> {
    data class Ok<T>(val result: T) : VerifyResult<T>()
    data class Warning<T>(val message: String, val ref: ConfigurationReference? = null) : VerifyResult<T>()
    data class Error<T>(val message: String, val ref: ConfigurationReference? = null) : VerifyResult<T>()
}

private fun <T> handleVerificationResultStrict(result: VerifyResult<T>): T {
    return handleVerificationResult(result, errorsAreWarnings = false)!!
}

private fun <T> handleVerificationResultWeak(result: VerifyResult<T>): T? {
    return handleVerificationResult(result, errorsAreWarnings = true)
}

private fun <T> handleVerificationResult(
    result: VerifyResult<T>,
    errorsAreWarnings: Boolean = false
): T? {
    return when (result) {
        is VerifyResult.Ok -> result.result

        is VerifyResult.Error -> {
            if (!errorsAreWarnings) {
                emitError(result)
            } else {
                emitWarning(VerifyResult.Warning<T>(result.message, result.ref))
                null
            }
        }

        is VerifyResult.Warning -> {
            emitWarning(result)
            null
        }
    }
}

fun verifyHost(host: Host, ref: ConfigurationReference? = null): VerifyResult<Host> {
    memScoped {
        val hints = alloc<addrinfo>()
        memset(hints.ptr, 0, sizeOf<addrinfo>().toULong())
        hints.ai_family = AF_UNSPEC
        hints.ai_socktype = SOCK_STREAM // TCP, please.
        hints.ai_flags = 0
        hints.ai_protocol = 0

        // Next, we use these hints to retrieve information about our requested host at the specified port
        val result = allocPointerTo<addrinfo>()
        if (getaddrinfo(host.host, host.port.toString(), hints.ptr, result.ptr) != 0) {
            return VerifyResult.Error<Host>(
                "The following host appears to be invalid: $host. Validate that the host name is correct and that " +
                    "you are able to connect to it.",
                ref
            )
        }

        freeaddrinfo(result.value)
    }
    return VerifyResult.Ok(host)
}

private fun verifyFile(
    path: String, 
    typeRequirement: FileType?,
    ref: ConfigurationReference? = null,
): VerifyResult<String> {
    val isOk = when (typeRequirement) {
        FileType.FILE -> fileExists(path) && !fileIsDirectory(path)
        FileType.DIRECTORY -> fileExists(path) && fileIsDirectory(path)
        else -> fileExists(path)
    }

    if (!isOk) {
        return when (typeRequirement) {
            FileType.DIRECTORY -> VerifyResult.Error<String>("No directory exists at '$path'", ref)
            null -> VerifyResult.Error<String>("No file exists at '$path'", ref)
            else -> {
                VerifyResult.Error<String>("No file exists at '$path'", ref)
            }
        }
    } else {
        return VerifyResult.Ok(path)
    }
}
