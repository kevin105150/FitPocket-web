# AI Instructions & APK Distribution Workflow

> **CRITICAL RULE FOR ALL FUTURE AI AGENTS**:
> Whenever you modify the Android code and rebuild the project, or whenever the user asks for the APK download link, you **MUST** follow this documented workflow to keep the Web APK Download Portal synchronized and running.

---

## 🏗️ Architecture & Mechanism

1. **Cloud Run / Nginx Proxying**:
   - The platform routes external web traffic through Nginx (port 8080) to the internal dev server port `localhost:3000`.
   - We run a lightweight Node.js server (`/app/applet/server.js`) on `0.0.0.0:3000` that handles CORS and serves static files (`index.html`, `apk.html`, `DietApp.part*`).

2. **Chunked Streaming Download System**:
   - The compiled Android APK (`app/build/outputs/apk/debug/app-debug.apk`, ~50MB) is split into 8 equal parts (`DietApp.part0` to `DietApp.part7`).
   - `apk.html` and `index.html` contain client-side JavaScript that fetches all 8 chunks with automatic retry, calculates real-time progress (0% - 100%), combines them in memory using `Blob([chunks], { type: 'application/vnd.android.package-archive' })`, and triggers the download as `DietApp-Release.apk`.
   - This bypasses proxy timeout and single-file payload size limits, guaranteeing 100% reliable downloads on mobile and desktop browsers.

---

## 🚀 Step-by-Step Guide to Update & Serve the APK

### Step 1: Compile the Android App
Run `compile_applet` tool to ensure the Kotlin / Compose code compiles and the debug APK is generated at:
`app/build/outputs/apk/debug/app-debug.apk`

### Step 2: Get APK File Size & Split into 8 Chunks
Run command in workspace root (`/app/applet`):
```bash
# 1. Get exact byte size
ls -l app/build/outputs/apk/debug/app-debug.apk
# Example output: 52731086 bytes

# 2. Divide byte size by 8 and round up:
# 52731086 / 8 = 6591385.75 -> 6591386

# 3. Split the APK into 8 parts (part0 - part7)
split -b 6591386 -d --suffix-length=1 app/build/outputs/apk/debug/app-debug.apk DietApp.part
```

### Step 3: Update `apk.html` and `index.html`
Update both `/app/applet/apk.html` and `/app/applet/index.html`:
1. Update `TOTAL_BYTES = <exact_bytes>;` in the `<script>` section.
2. Update the size text (e.g. `📊 完整大小： 50.3 MB（分段高速串流）`) and the description `<p class="description">...</p>` with what was changed in the latest update.

### Step 4: Ensure the Node.js Server is Running
Check if `node server.js` is running:
```bash
ps aux | grep node
```
If not running, launch it in background:
```bash
node server.js
```

Verify that local HTTP responds with 200:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/apk.html
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/apk.html
```

### Step 5: Provide Download Links to the User
Always provide the links clearly:
- **Development App URL**: `https://ais-dev-epbfpntukx7tu6x6gvscmt-644777657639.asia-northeast1.run.app`
- **Shared App URL**: `https://ais-pre-epbfpntukx7tu6x6gvscmt-644777657639.asia-northeast1.run.app`

---

## 📁 Key File Locations
- `/app/applet/server.js` — High-performance Node.js static & chunk file server.
- `/app/applet/apk.html` & `/app/applet/index.html` — The download portal UI matching the user's reference mockup.
- `/app/applet/DietApp.part[0-7]` — The split binary chunks of the latest APK.
- `/app/applet/APK_DISTRIBUTION_GUIDE.md` — Detailed documentation and troubleshooting.
