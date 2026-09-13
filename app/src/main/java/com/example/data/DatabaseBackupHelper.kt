package com.example.data

import android.content.Context
import android.util.Log
import com.example.data.local.DietDatabase
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream

object DatabaseBackupHelper {
    private const val TAG = "DatabaseBackupHelper"
    private const val DB_NAME = "diet_tracker_database"

    /**
     * Force checkpoints WAL records into the main database file, then copies it to [outputStream].
     */
    fun backup(context: Context, outputStream: OutputStream): Boolean {
        return try {
            val db = DietDatabase.getDatabase(context)
            
            // Flush WAL to main database file
            try {
                db.openHelper.writableDatabase.execSQL("PRAGMA wal_checkpoint(FULL)")
                Log.d(TAG, "WAL checkpointed successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to checkpoint WAL: ${e.message}", e)
            }

            val dbFile = context.getDatabasePath(DB_NAME)
            if (!dbFile.exists()) {
                Log.e(TAG, "Database file does not exist!")
                return false
            }

            FileInputStream(dbFile).use { input ->
                outputStream.use { output ->
                    input.copyTo(output)
                }
            }
            Log.d(TAG, "Database backup completed successfully")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error backing up database: ${e.message}", e)
            false
        }
    }

    /**
     * Closes the active database, replaces the main database file with contents of [inputStream],
     * deletes temporary WAL/SHM files, and resets the database singleton.
     */
    fun restore(context: Context, inputStream: InputStream): Boolean {
        return try {
            // Close active Room DB instance and reset the singleton
            DietDatabase.resetDatabaseInstance()
            Log.d(TAG, "Database closed and reset for restoration")

            val dbFile = context.getDatabasePath(DB_NAME)
            val walFile = File(dbFile.absolutePath + "-wal")
            val shmFile = File(dbFile.absolutePath + "-shm")

            // Ensure parent directory exists
            dbFile.parentFile?.let {
                if (!it.exists()) it.mkdirs()
            }

            // Copy backup stream to main DB file
            FileOutputStream(dbFile).use { output ->
                inputStream.use { input ->
                    input.copyTo(output)
                }
            }

            // Delete obsolete WAL and SHM files so they don't corrupt/overwrite the newly restored DB
            if (walFile.exists()) {
                val deleted = walFile.delete()
                Log.d(TAG, "Deleted WAL file: $deleted")
            }
            if (shmFile.exists()) {
                val deleted = shmFile.delete()
                Log.d(TAG, "Deleted SHM file: $deleted")
            }

            // Force load the database once to confirm it isn't corrupted
            try {
                val testDb = DietDatabase.getDatabase(context)
                testDb.openHelper.writableDatabase
                Log.d(TAG, "Restored database opened successfully, integrity OK")
            } catch (e: Exception) {
                Log.e(TAG, "Restored database failed to open! It might be corrupted: ${e.message}", e)
                return false
            }

            Log.d(TAG, "Database restoration completed successfully")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error restoring database: ${e.message}", e)
            false
        }
    }
}
