# Loop Engineering 說明書（迴圈驗證規範）

> **每一輪 loop 開工前，必須先完整讀完本文件。** 修改程式碼前再回來對照第 2、3 節，確認沒有離題。
> 目標：以「現階段功能」為範圍，**連續重複操作 100 次以上，所有功能不發生任何錯誤**。
> 建立日期：2026-11-13

---

## 0. 鐵則（每輪都適用）

> 完整規則見 **`docs/rules.md`**（範圍、修改、資料安全、驗證、Git）。以下為 Loop 摘要。

1. **範圍鎖定**：只驗證、修正第 2 節列出的功能。不新增功能、不改 UI 風格（iOS 風格沿用 `.agents/skills/ios-experience`）。想加的東西寫進 `docs/loop-log.md` 的「建議」欄，不要做。
2. **先讀後改**：每輪開始 → 讀本文件 → 讀上一輪 `docs/loop-log.md` 紀錄 → 才能動程式碼。
3. **最小修改**：一次只修一個根因；修完要能指出對應第 3 節哪一條不變量（I-xx）或第 4 節哪個操作（OP-xx）。
4. **絕不碰正式資料**：驗證一律用 `scripts/loop/run-loop.ps1`，它會在暫存資料夾啟動另一份 jar（獨立 SQLite 檔、獨立瀏覽器設定檔、埠號 18080），**不可對 `labelmanager.db` 或 8080 埠做壓力測試**。
5. **全綠才算一輪通過**：`mvn package`（含全部測試）全綠 + loop 腳本 0 錯誤。
6. 程式碼命名與註解用英文，介面文字用繁體中文。
7. 每輪結束在 `docs/loop-log.md` 追加一段紀錄（第 6 節格式）。

---

## 1. 系統概要

| 項目 | 內容 |
|---|---|
| 後端 | Spring Boot 3.2.5、Java 17、SQLite（`${user.dir}/labelmanager.db`，WAL，單一連線） |
| 前端 | 單一檔案 `src/main/resources/static/index.html`（HTML + CSS + Vanilla JS，無 build） |
| 時間 | 「今天」只由後端決定：`Clock`（Asia/Taipei） |
| 前端本機狀態 | `localStorage`：`lm_pages`（分頁）、`lm_spm`（層架→分頁對應）、`lm_theme`（日夜模式） |

### API 一覽

| 方法 | 路徑 | 用途 | 成功 |
|---|---|---|---|
| GET | `/api/shelves` | 取得所有層架與品項（依排序） | 200 |
| POST | `/api/shelves` | 新增層架 `{name}`（空白 → 「第 N 層」） | 201/200 |
| PUT | `/api/shelves/{id}/name` | 層架改名 `{name}` | 200 |
| PUT | `/api/shelves/move` | 層架排序 `{shelfId, targetIndex}`（全域索引） | 200 |
| DELETE | `/api/shelves/{id}` | 刪除空層架，其餘重新編號 | 200/204 |
| DELETE | `/api/shelves/last` | 刪除最後一層（需為空） | 200/204 |
| POST | `/api/shelves/{shelfId}/items` | 新增品項 `{name, thawDays, keepDays, thawDate?}` | 201/200 |
| PUT | `/api/items/{id}/retag` | 換標：解凍日 = 後端今天 | 200 |
| DELETE | `/api/items/{id}` | 刪除品項，同層重新排序 | 200/204 |
| PUT | `/api/items/move` | 移動品項 `{itemId, targetShelfId, targetIndex}` | 200 |
| GET | `/api/status/summary` | `{green, yellow, red, today}` | 200 |

錯誤一律回 JSON `{"error": "中文訊息"}`：400 輸入錯誤、404 找不到、409 狀態衝突、500 未預期。

---

## 2. 功能大綱（驗證範圍）

| 代號 | 功能 | 預期行為 |
|---|---|---|
| F1 | 頂部三色統計 | 綠/黃/紅數量 = 所有品項依狀態計數；與 `/api/status/summary` 一致 |
| F2 | 今天日期顯示 | 顯示「今天 MM/DD」，來源是後端 `today` |
| F3 | 層架列表 | 依 sortOrder 顯示；只顯示屬於目前分頁的層架 |
| F4 | 新增層架 | 彈窗輸入名稱（1–20 字，必填）→ 建立於最後，指派到目前分頁 |
| F5 | 層架改名 | 點名稱直接編輯，Enter/失焦送出；空白 → 提示並還原 |
| F6 | 刪除層架 | 點 ☰ → 有品項則提示不可刪；空的 → 確認後刪除 |
| F7 | 層架拖曳排序 | 拖 ☰ 調整順序；跨分頁時用全域索引換算，結果與畫面一致 |
| F8 | 新增品項 | 「+ 新增品項」彈窗：品名 1–30 字、解凍 0–30、保存 0–365、解凍日期；Stepper ± 不超出範圍 |
| F9 | 換標 | 確認後解凍日 = 今天，開封日/丟棄日/狀態重新計算 |
| F10 | 刪除品項 | 確認後刪除，同層其餘順序不變 |
| F11 | 品項拖曳 | 同層排序、跨層移動；滑鼠拖動 >4px、觸控長按 450ms 起拖；放開時存檔結果 = 佔位框位置；游標靜止時佔位框不可跳動（6px 遲滯） |
| F12 | 分頁 | 點分頁切換；再點目前分頁 → 設定彈窗改名/刪除（有層架不可刪，需兩次確認）；「+」新增分頁 |
| F13 | 防連點 | 操作進行中 `body.busy`，按鈕停用；同一操作只生效一次 |
| F14 | 自動更新 | 每 60 秒重新載入；跨午夜後日期與狀態更新 |
| F15 | 錯誤提示 | API 失敗 → 紅色 toast 顯示後端中文訊息，畫面資料保留 |
| F16 | **日夜模式切換** | 見第 2.1 節 |

### 2.1 F16 日夜模式（2026-11-13 新增）

- **切換方式**：頂部右側的 iPhone 風格切換開關（`#theme-switch`，`role="switch"`）。
  - 點擊切換；也可以**按住圓形把手左右拖曳**，放開時依位置決定（過半 → 夜間）。
  - 按下時把手會像 iOS 一樣微微拉長；放開以彈簧曲線回到定位。
  - 鍵盤：Tab 聚焦後 Space / Enter 切換。
- **狀態**：開關在左 = ☀️ 白天模式（`data-theme="light"`）；開關在右 = 🌙 夜間模式（`data-theme="dark"`，即原本的黑色佈景主題）。`aria-checked="true"` 代表夜間。
- **記憶**：手動切換後寫入 `localStorage.lm_theme`（`light` / `dark`）；重新整理後維持。從未手動切換時跟隨系統 `prefers-color-scheme`，系統改變時即時跟著變。
- **防閃爍**：`<head>` 內的小段腳本在 CSS 套用前就設定 `data-theme`。
- **情境元素**（只在頂部列、純裝飾、`aria-hidden`、`pointer-events:none`，不擋任何操作）：
  - 白天：太陽（光暈）、兩朵雲、淡藍天空漸層；開關軌道是藍天＋雲，把手是太陽。
  - 夜間：彎月、閃爍星星、深藍夜空漸層；開關軌道是夜空＋星星，把手是月亮。
  - 兩組元素以 CSS 變數 `--day` / `--night`（0 或 1）控制透明度，淡入淡出。
- **不影響**：切換主題不重新載入資料、不關閉彈窗、不影響拖曳；`busy` 狀態下仍可切換。

---

## 3. 不變量（每次操作後都必須成立）

| 代號 | 不變量 |
|---|---|
| I-01 | 畫面三色統計 = `/api/status/summary` 的 green/yellow/red |
| I-02 | 畫面上每層的品項順序 = `/api/shelves` 該層 items 順序 |
| I-03 | 每個品項：開封日 = 解凍日 + 解凍天數；丟棄日 = 開封日 + 保存天數 |
| I-04 | 狀態顏色符合規則：剩餘 ≥2 綠、=1 黃、≤0 紅 |
| I-05 | 每個層架恰好屬於一個存在的分頁（`lm_spm` 無孤兒、無遺漏） |
| I-06 | 操作結束後 `body` 沒有殘留 `busy` / `is-dragging`，`#drag-layer` 是空的，沒有殘留 `.slot` |
| I-07 | 所有彈窗操作結束後都是 `hidden`，`body.style.overflow` 恢復 |
| I-08 | Console 沒有任何 JS 錯誤（`error` / `unhandledrejection`） |
| I-09 | 合法操作的 API 回應沒有 4xx/5xx；不合法輸入回 400/404/409，**絕不出現 500** |
| I-10 | `data-theme` ∈ {light, dark}，且與開關 `aria-checked`、`lm_theme` 一致 |
| I-11 | 品項 ID 唯一；同一層 sortOrder 連續（0..n-1） |
| I-12 | 拖曳放開時佔位框的位置 = 存檔後的順序；游標靜止 4 幀內佔位框不移動 |

> 拖曳的「原始瞄準位置」與佔位框不同時只記為 **note（intent drift）**，不算錯誤：腳本是盲放，真人會看著佔位框調整。

---

## 4. 操作清單（Loop 的一個循環）

腳本會隨機（固定種子，可重現）抽取以下操作，**每輪 ≥ 100 次**，每次操作後檢查第 3 節全部不變量：

| 代號 | 操作 | 對應功能 |
|---|---|---|
| OP-01 | 新增品項（隨機合法名稱/天數，透過 UI 彈窗） | F8 |
| OP-02 | 新增品項不合法輸入（空名、天數超界）→ 應顯示欄位錯誤、不送出 | F8 |
| OP-03 | 換標（UI 按鈕 + 確認） | F9 |
| OP-04 | 刪除品項（UI × + 確認） | F10 |
| OP-05 | 同層移動品項（API，前端索引語意） | F11 |
| OP-06 | 跨層移動品項（API） | F11 |
| OP-07 | 新增層架（UI 彈窗） | F4 |
| OP-08 | 層架改名（UI 輸入 + change） | F5 |
| OP-09 | 刪除空層架（UI ☰ + 確認）／刪除非空層架應被擋 | F6 |
| OP-10 | 層架排序（API 全域索引） | F7 |
| OP-11 | 切換分頁、新增分頁、改分頁名 | F12 |
| OP-12 | 連點同一按鈕 5 次 → 只生效一次 | F13 |
| OP-13 | 切換日夜模式（點擊 / 拖曳把手 / 鍵盤） | F16 |
| OP-14 | 重新整理頁面 → 資料、分頁、主題都保留 | F3、F12、F16 |
| OP-15 | 送不合法 API（不存在 ID、壞 JSON）→ 4xx 且非 500 | F15 |

---

## 5. 驗證工具

| 檔案 | 說明 |
|---|---|
| `scripts/loop/run-loop.ps1` | 一鍵執行：建置 jar → 在暫存資料夾以 18080 埠啟動 → 開無頭 Chrome → 注入 `ui-loop.js` → 收集結果 → 關閉 |
| `scripts/loop/ui-loop.js` | 在瀏覽器內執行的操作腳本，實作第 4 節操作與第 3 節不變量檢查，回傳 JSON 報告 |

執行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/loop/run-loop.ps1 -Ops 120 -Seed 1
# 手機寬度：-Width 390；已建置過 jar：-SkipBuild
```

產出：`target/loop/report-<seed>.json`、`target/loop/shot-<seed>-<width>-light.png`、`-dark.png`。

流程：Phase A 用 DevTools 的**真實**滑鼠/鍵盤事件測切換開關（點擊、拖曳、短拖回彈、Space、Enter）→ Phase B 隨機操作，每 `-Chunk`（預設 30）次重新整理頁面驗證 OP-14。

注意：
- VS Code Java 擴充會鎖住 `target/test-classes`，`mvn clean` 可能失敗；改用 `mvn package`（會跑全部測試）。
- 腳本結束會依命令列 `--server.port=18080` 清掉測試用 JVM（PATH 上的 `java` 可能是啟動器，只殺父行程會殘留）。

---

## 6. 每輪流程（Loop 迭代）

```
1. 讀本說明書（全文） + docs/loop-log.md 最後一輪
2. mvn package（含測試）                            → 必須全綠
3. run-loop.ps1 -Ops ≥100 -Seed <本輪種子>          → 讀報告
4. 若有錯誤：找根因 → 對照第 2、3 節確認在範圍內 → 最小修改 → 回到 2
5. 全綠：在 docs/loop-log.md 追加紀錄，換新種子進入下一輪
```

`docs/loop-log.md` 紀錄格式：

```
## Round N — YYYY-MM-DD — seed S — ops K
- 結果：PASS / FAIL（錯誤數）
- 發現：OP-xx / I-xx …
- 修改：檔案與原因
- 建議（不在範圍內，未實作）：…
```
