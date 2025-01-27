//DEPS dk.sdu.cloud:k8-resources:0.1.0
package dk.sdu.cloud.k8

bundle {
    name = "support"
    version = "2022.1.30"

    withAmbassador {}

    val deployment = withDeployment {
        deployment.spec.replicas = Configuration.retrieve("defaultScale", "Default scale", 1)

        injectSecret("support-notifiers")
    }
}
