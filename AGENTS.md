# FitPocket AI Intelligence

這是一個專注於 AI 智慧飲食與運動管理的 Web 應用程式。

## 核心功能
- **AI 飲食估算**：透過圖片或文字快速計算營養成分。
- **Google Drive 同步**：自動備份您的飲食與健康紀錄。
- **專業訓練追蹤**：完整記錄您的健美與有氧訓練。

## AI 模型規範 (嚴格執行)
- **嚴禁使用 Gemini 3.x 以下的模型 (如 1.x, 2.x)**。
- 系統僅允許使用 `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.1-flash-lite`。
- 若模型回傳 503 或忙碌，應優先在 3.x 家族內進行後援切換 (Fallback)。
- 若所有 3.x 模型皆忙碌，應直接提示使用者「AI 伺服器忙碌中，請稍後重試」，不得私自切換至舊版本模型。
