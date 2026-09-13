package com.example.data.network

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

interface OpenFoodFactsService {

    @GET("cgi/search.pl")
    suspend fun searchProducts(
        @Query("search_terms") searchTerms: String,
        @Query("search_simple") searchSimple: Int = 1,
        @Query("action") action: String = "process",
        @Query("json") json: Int = 1,
        @Query("page_size") pageSize: Int = 30
    ): OpenFoodFactsResponse

    @GET("api/v0/product/{barcode}.json")
    suspend fun getProductByBarcode(
        @Path("barcode") barcode: String
    ): ProductBarcodeResponse
}

object OpenFoodFactsClient {
    // world.openfoodfacts.net is the stable live active search API mirror
    private const val PRIMARY_BASE_URL = "https://world.openfoodfacts.net/"
    private const val BACKUP_BASE_URL = "https://world.openfoodfacts.org/"

    private val userAgentInterceptor = Interceptor { chain ->
        val original = chain.request()
        val request = original.newBuilder()
            .header("User-Agent", "DietLogApp-Android/1.0 (Mozilla/5.0 Android compatible)")
            .header("Accept", "application/json")
            .method(original.method, original.body)
            .build()
        chain.proceed(request)
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(userAgentInterceptor)
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .build()

    private val moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    val primaryService: OpenFoodFactsService by lazy {
        createService(PRIMARY_BASE_URL)
    }

    val backupService: OpenFoodFactsService by lazy {
        createService(BACKUP_BASE_URL)
    }

    private fun createService(baseUrl: String): OpenFoodFactsService {
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(OpenFoodFactsService::class.java)
    }
}
