package dk.sdu.cloud.indexing.api

import dk.sdu.cloud.client.ServiceDescription

object IndexingServiceDescription : ServiceDescription {
    override val name: String = "indexing"
    override val version: String = "1.0.0-SNAPSHOT"
}