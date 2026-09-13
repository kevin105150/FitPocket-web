package com.example.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "weight_records")
data class WeightRecord(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val morningWeightKg: Double? = null,
    val morningTime: String? = null, // e.g. "08:30"
    val eveningWeightKg: Double? = null,
    val eveningTime: String? = null, // e.g. "21:15"
    val date: String, // YYYY-MM-DD
    val createdAt: Long = System.currentTimeMillis()
)
