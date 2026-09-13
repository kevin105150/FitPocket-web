# FitPocket APK 下載網站建置與更新操作指南 (APK Distribution Manual)

本文件完整記錄了此專案「網頁端 APK 高速分段串流下載機制」的運作原理、檔案結構及後續維護更新 SOP。

---

## 一、 系統架構與運作原理

### 1. 為什麼採用分段下載（Chunked Streaming）？
- Android APK 檔案較大（約 35MB ~ 55MB），在雲端容器環境（Google Cloud Run）與行動裝置網路下，單一大檔直接下載容易遇到 HTTP 連線逾時、中斷或緩衝限制。
- 透過將 APK 拆分為 8 個分段檔案（`DietApp.part0` 至 `DietApp.part7`），前端網頁透過非同步平行/佇列請求抓取並回報進度，在客戶端瀏覽器組裝成二進位 Blob 後自動觸發儲存為 `DietApp-Release.apk`。

### 2. 端口與代理路由
- 外部瀏覽器連線至 Google Cloud Run，經由 Nginx（端口 8080）反向代理至內部的 `localhost:3000`。
- 我們在 `localhost:3000` 上運行輕量級的 Node.js 服務（`server.js`），負責提供 `apk.html`、`index.html` 以及各個 `DietApp.part*` 分段資料。

---

## 二、 核心檔案結構

| 檔案路徑 | 說明 |
| :--- | :--- |
| `/server.js` | 專用 Node.js HTTP 伺服器，支援 CORS、串流與靜態檔案分發。 |
| `/apk.html` | 專屬 APK 下載網頁（完全比照專屬卡片視覺設計、進度條與傳輸提示）。 |
| `/index.html` | 根目錄首頁導向，內容與 `apk.html` 同步，確保輸入網域名稱即可直接進入。 |
| `/DietApp.part0` ~ `/DietApp.part7` | 編譯產出的 APK 二進位切片檔案。 |
| `/AGENTS.md` | 注入給 AI 系統的自動化指令集，確保未來 AI 接手時自動遵循此流程。 |

---

## 三、 更新 APK 之標準作業流程 (SOP)

當 App 原始碼修改完成並建置後，請依序執行以下 5 個步驟：

### 步驟 1：編譯最新 APK
執行專案編譯工具以產出最新的 APK 檔案：
檔案位於：`app/build/outputs/apk/debug/app-debug.apk`

### 步驟 2：計算位元組並切分為 8 個分段
```bash
# 取得檔案精確大小 (Bytes)
ls -l app/build/outputs/apk/debug/app-debug.apk

# 將總 Bytes 除以 8 並向上取整數 (假設大小為 52731086 Bytes，則每片約 6591386 Bytes)
split -b 6591386 -d --suffix-length=1 app/build/outputs/apk/debug/app-debug.apk DietApp.part
```

### 步驟 3：更新網頁說明與位元組參數
在 `apk.html` 與 `index.html` 中：
1. 將 `<script>` 區塊內的 `TOTAL_BYTES` 更新為最新檔案的實際位元組大小。
2. 更新版本說明 `<p class="description">...</p>`，註明本次修正項目。
3. 更新檔案大小資訊標籤（例如：`50.3 MB`）。

### 步驟 4：確認 Node.js 伺服器運作狀態
確認背景行程是否正在監聽 3000 端口：
```bash
ps aux | grep node
```
若未啟動，執行：
```bash
node server.js
```
並驗證本機回應：
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/apk.html
# 應回傳 200
```

### 步驟 5：向使用者回報下載連結
提供正確的存取網址：
- **主要發布網址**：`https://ais-dev-epbfpntukx7tu6x6gvscmt-644777657639.asia-northeast1.run.app`
- **備用下載路徑**：`https://ais-dev-epbfpntukx7tu6x6gvscmt-644777657639.asia-northeast1.run.app/apk.html`
