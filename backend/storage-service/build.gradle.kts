version = "4.3.0-rc1"

application {
    mainClassName = "dk.sdu.cloud.file.MainKt"
}

dependencies {
    implementation(project(":auth-service:api"))
    implementation(project(":task-service:api"))
    implementation(project(":notification-service:api"))
    implementation(project(":project-service:api"))
    implementation(project(":accounting-service:api"))
    implementation("net.java.dev.jna:jna:5.2.0")
    implementation("org.apache.commons:commons-compress:1.20")
}
