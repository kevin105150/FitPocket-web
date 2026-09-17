package com.example.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "water_records")
data class WaterRecord(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val date: String, // YYYY-MM-DD
    val amountMl: Double,
    val timestamp: Long = System.currentTimeMillis()
)
