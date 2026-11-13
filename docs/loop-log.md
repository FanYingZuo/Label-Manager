# Loop 紀錄

> 格式見 `docs/loop-engineering.md` 第 6 節。每輪開工前先讀說明書與本檔最後一輪。

## Round 0 — 2026-11-13 — 建立
- 撰寫說明書 `docs/loop-engineering.md`、驗證工具 `scripts/loop/run-loop.ps1` + `ui-loop.js`。
- 新增 F16 日夜模式（iOS 切換開關、白天太陽/雲、夜間月亮/星星）。
- 煙霧測試 seed 99、20 ops：PASS。

## Round 1 — 2026-11-13 — seed 1 — ops 120
- 結果：**FAIL**（3）
- 發現：OP-15 / I-09
  - `PUT /api/items/move {}`、`PUT /api/shelves/move {}` → **500**（null ID 傳進 repository）。
  - `POST /api/shelves/{id}/items` 缺 `thawDays` → 被接受並存成 0（DTO 用 `int`）。
- 修改：
  - `dto/CreateItemRequest`：`thawDays`/`keepDays` 改 `Integer`；`dto/MoveItemRequest`、`dto/MoveShelfRequest`：`targetIndex` 改 `Integer`。
  - `service/LabelManagerService`：天數 null → 400；move 缺 ID → 400；`targetIndex` null → 放最後（符合 stabilization-plan 2.4）。
  - `ApiControllerTest` 新增 2 個回歸測試（37/37 綠）。

## Round 2 — 2026-11-13 — seeds 1, 2, 3 — ops 360
- 結果：seed 1、3 PASS；seed 2 **FAIL**（1）
- 發現：OP-11 / F12 — 按「+」新增分頁後只重畫分頁列（`renderPages()`），層架區仍顯示上一頁的層架。
  另：分頁彈窗自己做開關動畫、沒清掉關閉計時器，200ms 內重開會被舊計時器關掉。
- 修改：`index.html` 新增分頁改呼叫 `render()`；分頁彈窗改用共用 `showModal`/`hideModal`。
- 工具：`ui-loop.js` 加入 I-05 擴充檢查「畫面上的層架 = 目前分頁擁有的層架」。

## Round 3 — 2026-11-13 — seeds 2, 4, 5 — ops 360
- 結果：seed 4、5 PASS；seed 2 FAIL（1）— 拖曳結果與「事先算好的目標位置」差一格。
- 分析：屬於驗證工具誤判。跨層拖曳時來源層少一張卡會縮短一列，目標層往上移；真人會看著佔位框調整，腳本是盲放。
- 修改（只改工具）：拖曳驗證改為「放開時佔位框的位置 = 存檔結果」＋「游標靜止時佔位框不可跳動」；與原始意圖的差異只記為 note。

## Round 4 — 2026-11-13 — seeds 2, 6, 7 — ops 360
- 結果：seed 2、7 PASS；seed 6 **FAIL**（1）
- 發現：OP-06 / F11 — **游標靜止時佔位框在兩層之間每一幀來回跳**（shelf 7 ↔ shelf 12）。
  佔位框移走 → 版面重排 → 靜止的游標落到另一層 → 又移回來。
- 修改：`index.html` `placeSlot` 加入遲滯（hysteresis）：佔位框移動後，游標需在頁面座標移動 ≥ 6px 才能再移動（自動捲動會改變頁面座標，所以不受影響）；層架高亮跟隨佔位框實際位置。

## Round 5 — 2026-11-13 — seeds 6, 8, 9, 10 — ops 480
- 結果：**PASS**（0 錯誤，含 Round 4 的重現種子 6）
- note：3 次 intent drift（工具盲放造成，非錯誤）。

## Round 6 — 2026-11-13 — seeds 11 (390px), 12 (1280px), 13 (390px) — ops 500
- 結果：**PASS**（0 錯誤、0 JS 例外、0 伺服器 ERROR）
- 手機寬度截圖：頂部列、切換開關、日夜元素皆正常。
- 建議（不在範圍內，未實作）：
  - 後端未檢查 `thawDate` 不可晚於今天（stabilization-plan 2.3 有要求）；前端日期欄也可選未來日期。
  - 層架/品項「找不到」目前回 400（`IllegalArgumentException`），stabilization-plan 2.1 規定應為 404。

## Round 7 — 2026-11-14 — seed 14 (1280px, 日夜時段自動) / seed 15 (1280px, 只允許本機) — ops 120 × 2
- 結果：**PASS**（兩次皆 0 操作錯誤、0 JS 例外、0 伺服器 ERROR；Phase A 0 錯誤）
- 需求變更（使用者）：
  - 日夜模式改為 **16:00–04:00 夜間、其餘白天**；可手動切換，手動結果保留到下一個時段界線，到點自動切換。
  - **只允許電腦操作**，手機與平板不可操作或觀看。
- 修改：
  - `index.html`：`<head>` 與主程式改用 `window.lmTheme`（時段＋覆蓋值）；`localStorage.lm_theme` 改為 `lm_theme_override`（`{theme, until}`）；移除系統偏好跟隨；每 30 秒與回到分頁時同步。
  - `config/LocalOnlyFilter.java`（新增）：非迴環位址回 403，訊息「僅允許本機電腦使用」。`LocalOnlyFilterTest` 3 項測試。
  - `run-loop.ps1` Phase A2：時段界線檢查（15:59 白天、16:00 夜間、03:59 夜間、04:00 白天、界線計算）＋覆蓋值過期後 35 秒內自動回到時段（A6–A8）。
  - `ui-loop.js`：I-10、OP-13、OP-14 改用新的覆蓋值；I-10 在時段剛改變的 31 秒內略過比對。
- 測試：`mvn package` 40/40 綠。
- 版面：本輪只跑 1280px；手機與平板已不在範圍內，`rules.md` 的 390px 要求已移除。
