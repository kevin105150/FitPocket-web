# FitPocket AI - 100% 原生 Android (Jetpack Compose) 開發計畫書

本計畫書記錄了 FitPocket 轉型為 100% 純原生 Android (Jetpack Compose) 應用程式的詳細開發步驟、技術指引以及關鍵的開發原則。

---

## ⚠️ 核心開發原則 (Critical Development Principles)

在後續的任何開發與生成階段中，**必須無條件遵守**以下三大原則：

1. **Web 端絕對穩定性 (Web App Integrity)**
   - **原則**：在開發、重構、甚至完全重寫 Android 專案的過程中，**必須確保 Web 端網頁版應用程式保持 100% 正常運作且完全不受影響**。
   - **執行**：Android 專案的所有程式碼變更與檔案結構調整必須被限制在 `/app` 目錄中。不得意外修改或破壞 Web 端的 `/src`、`server.ts`、`package.json` 等網頁端核心檔案。

2. **資料庫格式與 Web 端同源 (Database & Format Sync)**
   - **原則**：Android 端的**飲食資料庫格式、運動日誌格式、體重紀錄格式以及水分紀錄等所有 Data Model，一律以目前 Web 端的資料結構（LocalStorage / 備份 JSON 結構）為絕對基準**。
   - **執行**：在設計 Android Room DB 實體 (Entities) 時，其欄位名稱、資料型別、Json 序列化格式必須與 Web 端保持 100% 互通。這樣能確保未來透過 Google Drive 進行雲端同步時，網頁端與 App 端的備份檔案可以完美兼容、無痛互導。

3. **Android 端可完全重寫 (Scrap & Rebuild Android Part)**
   - **原則**：為了追求最乾淨、最符合最新 Android 開發規範的架構，**現有的 `/app` 目錄中所有原生 Kotlin 程式碼均可視需要「直接清除、打掉重來」**。
   - **執行**：在開始建置時，若發現原有 Android 程式碼存在相容性或舊架構問題，我們將毫不猶豫地進行重寫，以確保最極致的 Native 效能與程式碼可讀性。

---

## 📅 Android 逐步生成路線圖 (Step-by-Step Android Roadmap)

以下為 100% 純原生（無 WebView）Android 應用的開發步驟：

### **步驟 1：基礎環境與依賴庫配置 (Foundation & Gradle Setup)**
* **任務**：整理或重寫 `/app/build.gradle.kts`，引入現代化 Compose 與 Android 官方套件。
* **主要套件**：
  - Jetpack Compose + Compose Navigation (頁面導航)
  - Room Database & KSP (本地 SQLite 資料庫與編譯工具)
  - Google GenAI Kotlin SDK (用於原生直接呼叫 Gemini API)
  - Google Play Services & Google Drive REST API (雲端同步備份)
  - Coroutines & Flow (非同步狀態管理)

### **步驟 2：資料模型與 Room 本地資料庫設計 (Local Database & DAOs)**
* **任務**：依據 Web 端資料格式 1:1 轉譯設計 Room 資料庫。
* **設計實體**：
  - `DietRecord` (飲食紀錄餐次)
  - `WaterLog` (水分攝取紀錄)
  - `WeightRecord` (每日體重紀錄)
  - `WorkoutSession` (健身組數與動作)
  - `UserGoal` (TDEE 與碳循環設定)

### **步驟 3：設計標記與自訂主題系統 (Design Tokens & Color.kt / Theme.kt)**
* **任務**：移植網頁端最新升級的「天空藍 (Sky Blue) 方案」至 Compose 主題。
* **設計內容**：
  - `Color.kt`：宣告 Sky Blue 主色 (`Color(0xFF0284C7)`)、亮藍色 (`Color(0xFF38BDF8)`)、與淡藍背景色。保留三大營養素經典色。
  - `Type.kt`：載入 **Plus Jakarta Sans** 字體檔並配置字級、行高與行距。
  - `Theme.kt`：打造完美支援系統 Dark Mode（深色模式）的 `MyApplicationTheme`。

### **步驟 4：核心業務邏輯與 ViewModel 實作 (Shared Logic & ViewModels)**
* **任務**：撰寫負責處理商業邏輯與維護 UI State 的核心狀態機。
* **主要 ViewModel**：
  - `DietViewModel` (餐食新增、自訂食物搜尋、三大營養素換算、Gemini AI 辨識分析)
  - `WorkoutViewModel` (運動日誌、組數勾選狀態、協程計時器)
  - `WeightViewModel` (體重趨勢、TDEE 計算邏輯)
* **注意 (Model Update)**：由於 Gemini 已不支援 1.5 系列模型，此步驟中的原生 AI 對接服務 (`GeminiNutritionService`) 已全面升級至 **`gemini-3.5-flash`**，以確保最快且穩定的 AI 回應。

### **步驟 5：App 主外殼與導航架構建立 (App Shell & Navigation)**
* **任務**：建立與 Web 端完全相同的四分頁導航外殼。
* **實作組件**：
  - `MainContainerScreen.kt`：使用 `Scaffold` 搭配 `NavigationBar`，製作滑動流暢、具備選取縮放動畫的「飲食」、「運動」、「數據」、「設定」底部導航。

### **步驟 6：各分頁高解析度 Compose 畫面刻畫 (Screen UI Implementations)**
* **任務**：利用 Compose Canvas 與排版系統 1:1 還原精美介面。
* **開發畫面**：
  - `DietTrackerScreen.kt` (三大營養素圓環、餐點卡片)
  - `TrainingTrackerScreen.kt` (動作清單、組數勾選、新增組數介面)
  - `WeightTrackerScreen.kt` (利用 Canvas 繪製具備淡藍漸層填充的平滑體重曲線圖)
  - `WaterTrackerScreen.kt` (利用 Canvas 繪製具有波浪動畫的水位上升控制)

### [x] **步驟 7：彈窗、自訂元件與計時器細節研磨 (Modals & Micropresentations)**
* **任務**：補齊所有輔助微互動與操作彈窗。
* **實作內容**：
  - `PortionDialog.kt` (滑動份量與自訂加入彈窗)
  - `GoalSettingDialog.kt` (碳循環與 TDEE 試算彈窗)
  - `WorkoutTimerModal.kt` (利用 Kotlin 協程開發的組間休息倒數計時器)

### [x] **步驟 8：外接服務串接與同源測試 (API & Data Integrity Sync Test)**
* **任務**：串接 Gemini API 與 Google Drive 進行全功能測試。
* **測試要點**：
  - 驗證本機拍下的食物照片能成功透過 Gemini SDK 解析出三大營養素。
  - 驗證 Room 產生的資料備份檔與 Web 備份檔格式完全同源，上傳 Google Drive 後可流暢互通。
  - 切斷網路，驗證本機 Room DB 資料完整性與組間休息碼錶的離線運作。

---

## 🔑 APK 簽署與編譯規則 (APK Signing & Compilation Rules)

在 Android 專案中，APK 的金鑰簽署與 Gradle 建置規則定義如下：

### 1. 金鑰庫與簽署配置 (Keystore Configuration)
在 `/app/build.gradle.kts` 中，系統定義了兩種簽署配置：
*   **Debug 配置 (`debugConfig`)**：
    *   金鑰庫路徑：`${rootDir}/debug.keystore`
    *   金鑰密碼：`android`
    *   別名：`androiddebugkey`
    *   別名密碼：`android`
*   **Release 配置 (`release`)**：
    *   金鑰庫路徑：優先讀取環境變數 `KEYSTORE_PATH`，預設為 `${rootDir}/my-upload-key.jks`
    *   金鑰密碼：讀取自環境變數 `STORE_PASSWORD`
    *   別名：`upload`
    *   別名密碼：讀取自環境變數 `KEY_PASSWORD`

目前在建置設定中，不論是 `debug` 還是 `release` 的編譯類型（Build Types），預設都指向 **`debugConfig`** 來進行本機或測試的簽署。

### 2. 本機編譯前置準備 (Pre-build Requirement)
由於 `.gitignore` 排除了金鑰庫二進位檔 `debug.keystore`，專案根目錄中提供了一個 Base64 編碼的備份檔 **`debug.keystore.base64`**。

在您進行任何 Gradle 編譯之前，**必須先將該 Base64 檔案解碼還原**，否則 Gradle 會因為找不到金鑰檔而報錯。請於根目錄執行以下命令：

*   **Linux / WSL / 雲端容器環境**：
    ```bash
    base64 -d debug.keystore.base64 > debug.keystore
    ```
*   **macOS 環境**：
    ```bash
    base64 -D -i debug.keystore.base64 -o debug.keystore
    ```
*   **Windows Powershell 環境**：
    ```powershell
    [System.Convert]::FromBase64String((Get-Content debug.keystore.base64 -Raw)) | Set-Content debug.keystore -Encoding Byte
    ```

### 3. APK 編譯指令 (Compilation Commands)
解碼出 `debug.keystore` 後，即可於專案根目錄執行以下 Gradle 指令進行 APK 生成：

*   **建置測試版 APK (Debug APK)**：
    ```bash
    ./gradlew :app:assembleDebug
    ```
    *   *產出位置*：`/app/build/outputs/apk/debug/app-debug.apk`
*   **建置發行版 APK (Release APK - 預設以 debug 密鑰簽署)**：
    ```bash
    ./gradlew :app:assembleRelease
    ```
    *   *產出位置*：`/app/build/outputs/apk/release/app-release.apk`

---

## 🧩 4. APK 分卷切塊與瀏覽器下載方案 (APK Splitting & Web Reassembly)

為了繞過雲端分享平台對單一檔案大小（如超過 10MB）的傳輸限制，專案內建了 **APK 分卷切塊 (Splitting)** 與 **瀏覽器前端重組 (Web Reassembly)** 方案。

### 1. 為什麼要切塊？
當您編譯出的 APK 太大，在進行 AI Studio 分享或匯出時，可能會因為大小限制而傳輸失敗。將其切成數個 `3MB` 的分卷檔案，可以 100% 保證傳輸順暢。

### 2. APK 切塊指令 (Linux / macOS)
在編譯出 APK 之後，您可以在專案根目錄下執行以下指令將 APK 切塊：
```bash
# 將 app-debug.apk 以每 3MB 切成名為 DietApp.partxx 的檔案
split -b 3M .build-outputs/app-debug.apk DietApp.part
```
這會自動生成如 `DietApp.partaa`、`DietApp.partab`、`DietApp.partac` 等檔案，大小皆在 3MB 以內。

### 3. 合併還原指令
*   **終端機直接合併** (如果您已下載所有分卷到本地電腦)：
    ```bash
    cat DietApp.part* > FitPocket.apk
    ```
*   **瀏覽器自動重組下載 (Web 服務支援)**：
    後端 `server.ts` 內建了以下兩個路由：
    - `/apk.html`：服務 APK 下載引導頁面。
    - `/DietApp.part*`：提供切塊分卷的下載。
    
    當您訪問 `/apk.html` 時，網頁前端會利用 `fetch` 自動依序下載所有分卷，在瀏覽器記憶體中重組為一個完整的 `Blob`，並自動為您儲存下載為完美的 `FitPocket.apk`！

