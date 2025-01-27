package dk.sdu.cloud.extract.data.api

import kotlinx.serialization.Serializable

@Serializable
data class WalletInfo(
    val accountId: String,
    val allocated: Long,
    val productType: ProductType
)
