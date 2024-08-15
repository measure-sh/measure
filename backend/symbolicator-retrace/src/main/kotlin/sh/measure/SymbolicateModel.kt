package sh.measure

import kotlinx.serialization.Serializable

@Serializable
data class SymbolicateRequest(
    val key: String, val data: List<DataUnit>
)

@Serializable
data class DataUnit(
    val id: String, val values: List<String>
)

@Serializable
data class ErrorResponse(val error: String, val details: String? = null)