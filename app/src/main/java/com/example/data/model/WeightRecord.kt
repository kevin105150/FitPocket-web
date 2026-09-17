package com.example.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "weight_records")
data class WeightRecord(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val date: String, // YYYY-MM-DD
    val morningWeightKg: Double? = null,
    val morningTime: String? = null, // e.g. "08:30"
    val eveningWeightKg: Double? = null,
    val eveningTime: String? = null, // e.g. "21:15"
    val createdAt: Long = System.currentTimeMillis()
)
