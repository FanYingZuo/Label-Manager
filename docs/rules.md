# 開發與驗證規則（Rules）

> 適用對象：所有修改本專案的人（含 AI 助手）。**每次動程式碼前先讀本文件與 `docs/loop-engineering.md`。**
> 最後更新：2026-11-13

---

## 1. 範圍規則

1. **只修不加**：Loop 期間只驗證、修正 `docs/loop-engineering.md` 第 2 節列出的功能（F1–F16）。想加的功能寫進 `docs/loop-log.md` 的「建議」欄，不要實作。
2. **不改 UI 風格**：沿用 iOS 風格（`.agents/skills/ios-experience`）。日夜兩套主題都要能正常顯示。
3. **不加**：登入、列印、通知、多店、雲端部署（見 `docs/progress.md`）。

## 2. 修改規則

1. **先讀後改**：每輪開始 → 讀 `rules.md` → 讀 `loop-engineering.md` → 讀 `loop-log.md` 最後一輪 → 才能動程式碼。
2. **一次一個根因**：每個修改都要對應到某條不變量（I-xx）或某個操作（OP-xx）。
3. **有修必有測**：後端 bug 修完要在 `src/test/**` 補回歸測試；前端 bug 要能用 loop 腳本重現與驗證。
4. **日期只由後端決定**：前端不可自行用瀏覽器時間計算「今天」。
5. **錯誤格式固定**：所有錯誤回 `{"error": "中文訊息"}`；400 輸入錯誤、404 找不到、409 狀態衝突；**合法或不合法輸入都不可出現 500**。
6. **命名與語言**：程式碼命名與註解用英文，介面文字用繁體中文。

## 3. 資料安全規則

1. **絕不對正式資料做測試**：壓力測試與 loop 一律用 `scripts/loop/run-loop.ps1`（獨立資料夾、獨立 SQLite、埠號 18080）。
2. 不可對 `labelmanager.db` 或 8080 埠跑自動化操作。
3. 自動化測試使用 `test` profile（記憶體資料庫），不可移除 `@ActiveProfiles("test")`。
4. 動到資料庫相關程式碼前，先把 `labelmanager.db`（連同 `-wal`、`-shm`）複製一份備份。

## 4. 驗證規則（一輪通過的條件）

| 項目 | 標準 |
|---|---|
| 單元／整合測試 | `mvn package` 全綠 |
| Loop 操作次數 | 每輪 ≥ 100 次 |
| Loop 結果 | 0 操作錯誤、0 JS 例外、0 伺服器 ERROR、`PASS=True` |
| 版面 | 1280px 與 390px（手機）各跑過至少一次 |
| 紀錄 | 在 `docs/loop-log.md` 追加本輪紀錄 |

## 5. Git 規則

1. Commit 訊息用 `feat:` / `fix:` / `docs:` / `test:` / `chore:` 開頭，說明寫中文。
2. 測試沒全綠不可 commit 到 `main`。
3. 不 commit `labelmanager.db*`、`target/`（已在 `.gitignore`）。
