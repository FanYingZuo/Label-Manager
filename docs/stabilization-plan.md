# 穩定化計畫（Stabilization Plan）

> 負責人：專案 Lead（本文件作者）。所有子 session 開工前**必須先讀完本文件**。
> 目標：讓 Label Manager 在**單店單機**長期穩定運作，**不新增功能**，只修正、補強、驗證。
> 最後更新：2026-11-08

---

## 0. 鐵則（所有人都適用）

1. **不新增功能**。只能修 bug、補驗證、補測試、補部署。看到「想加的東西」寫進回報，不要做。
2. **只改自己負責的檔案**（見第 3 節「檔案所有權」）。需要別人的檔案改動 → 寫在回報裡，由 Lead 轉派。
3. 每個人在自己的 git 分支工作：`fix/<角色代號>`，例如 `fix/c2-service`。不直接 commit 到 `main`。
4. 開工前先備份：`labelmanager.db` 複製一份到 `labelmanager.db.bak-日期`。
5. **在 T0 任務（測試資料庫隔離）合併之前，不准在專案資料夾執行 `mvn test`**——目前測試會 `deleteAll()` 清空真正的 `labelmanager.db`。
6. 結束時在 `docs/reports/<角色代號>.md` 寫回報：做了什麼、改了哪些檔案、還沒解決的、需要別人做的。
7. 程式碼命名與註解用英文，介面文字用繁體中文（依 `requirements.md` 第 7 節）。
8. `mvn clean test` 全綠才可以提出合併。

---

## 1. 現況盤點（Lead 已讀過全部程式碼）

架構：Spring Boot 3.2.5 + SQLite + 純 HTML/JS 前端，單一 Service（`LabelManagerService`），3 個 Controller，純 Java 領域層（`DateCalculator` / `ItemStatus`）。
功能面已大致完成，問題集中在**穩定性與正確性**：

| # | 嚴重度 | 問題 | 位置 | 負責 |
|---|---|---|---|---|
| B1 | 🔴 致命 | 測試直接用正式 DB，`ApiControllerTest` 的 `deleteAll()` 會清空店內真實資料 | `application.properties`、`ApiControllerTest` | T0 |
| B2 | 🔴 致命 | DB 路徑是相對路徑 `jdbc:sqlite:labelmanager.db`，從不同資料夾啟動 = 開一個新的空 DB，看起來像「資料全不見」，且會自動塞範例假資料 | `application.properties`、`DataInitializer` | C3 |
| B3 | 🔴 高 | 同層往後拖曳位置會錯一格（例：A,B,C 把 A 拖到 C 前面 → 結果變 B,C,A，應為 B,A,C）。前端送的 `targetIndex` 包含被拖曳的卡片本身 | `app.js` `setupRackDropZone` | C4 |
| B4 | 🔴 高 | 換標與新增品項的解凍日是**瀏覽器時間**送給後端，違反「日期由後端計算」；電腦時鐘錯就會寫錯標籤 | `app.js` `handleRetag` / 新增表單、`ItemController` | C1 + C4 |
| B5 | 🟠 高 | 沒有全域例外處理：品項不存在、品名空白、負數天數等都變 **500**，前端只顯示「操作失敗」 | Controllers | C1 |
| B6 | 🟠 高 | 頁面整天開著不會更新：過了午夜「今天」與紅黃綠狀態全部是舊的 | `app.js` | C4 |
| B7 | 🟠 中 | 按鈕沒有防連點：連點「新增」會產生重複品項、連點換標會重送 | `app.js` | C4 |
| B8 | 🟠 中 | 輸入驗證不足：解凍天數欄位清空會變成 `null → 0` 悄悄存進去；品名、層架名稱沒有長度上限；天數沒有上限 | `LabelManagerService`、`app.js` | C2 + C4 |
| B9 | 🟠 中 | 刪除中間層架後，排序重編但名稱還是舊的「第 4 層」，與徽章「第 3 層」對不起來 | `LabelManagerService.removeShelf` | C2 |
| B10 | 🟠 中 | `@CrossOrigin` 全開且無登入 → 店內電腦瀏覽任何惡意網頁都可能呼叫 API 刪資料 | 3 個 Controller | C1 |
| B11 | 🟡 中 | SQLite 未設定 WAL / busy_timeout / 單一連線，兩個分頁同時操作可能出現 `SQLITE_BUSY` | `application.properties` | C3 |
| B12 | 🟡 中 | `LocalDate.now()` 依賴 JVM 預設時區，沒有固定 Asia/Taipei，也無法在測試中控制時間 | `LabelManagerService` | C3 + C2 |
| B13 | 🟡 中 | 沒有任何備份機制；SQLite 檔案壞掉 = 全部重來 | — | C3 |
| B14 | 🟡 低 | `loadData` 失敗時整個層架畫面被換成錯誤訊息，暫時斷線就看不到資料 | `app.js` | C4 |
| B15 | 🟡 低 | 沒有正式的啟動方式（店員不會打 `mvn spring-boot:run`），也沒有開機自動啟動、沒有 log 檔 | 部署 | C3 |

Debugger 在階段 0 要**逐條確認或推翻**以上清單，並補上 Lead 沒發現的。

---

## 2. Lead 已拍板的決定（介面契約，所有人照這個做）

### 2.1 錯誤回應格式
所有錯誤一律回傳 JSON：`{"error": "給店員看的中文訊息"}`

| 情況 | 例外類別 | HTTP |
|---|---|---|
| 輸入不合法（空白品名、負數、超出上限、缺欄位） | `IllegalArgumentException` | 400 |
| 找不到層架 / 品項 | `com.example.labelmanager.service.NotFoundException` | 404 |
| 狀態衝突（層架仍有品項不可刪） | `IllegalStateException` | 409 |
| JSON 格式錯誤 / 型別錯誤 | `HttpMessageNotReadableException` 等 | 400，訊息「資料格式錯誤」 |
| 其他未預期錯誤 | `Exception` | 500，訊息「系統發生錯誤，請重新整理頁面」，**完整 stack trace 寫進 log** |

### 2.2 共用新檔案（內容固定，C1、C2 若都需要就各自建立**完全相同**的內容，git 合併不會衝突）

`src/main/java/com/example/labelmanager/service/NotFoundException.java`
```java
package com.example.labelmanager.service;

public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
```

`src/main/java/com/example/labelmanager/dto/SummaryResponse.java`
```java
package com.example.labelmanager.dto;

import java.time.LocalDate;

public record SummaryResponse(int green, int yellow, int red, LocalDate today) {
}
```

`src/main/java/com/example/labelmanager/config/TimeConfig.java`（C3 建立，C2 注入使用）
```java
package com.example.labelmanager.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class TimeConfig {
    public static final ZoneId STORE_ZONE = ZoneId.of("Asia/Taipei");

    @Bean
    public Clock clock() {
        return Clock.system(STORE_ZONE);
    }
}
```

### 2.3 日期
- 「今天」**只由後端決定**：`LocalDate.now(clock)`。
- `PUT /api/items/{id}/retag`：**忽略 request body**，解凍日一律 = 後端今天。
- `POST /api/shelves/{id}/items`：`thawDate` 可省略（= 今天）；若有送，**不可晚於今天**，否則 400。前端**不再送** `thawDate`。
- `?today=` 查詢參數保留給測試用，前端**永遠不送**。
- `GET /api/status/summary` 改回傳 `SummaryResponse`（多一個 `today` 欄位），前端頂部的「今天」顯示這個值。

### 2.4 輸入上限
| 欄位 | 規則 |
|---|---|
| 品名 | trim 後 1–30 字 |
| 層架名稱 | trim 後 0–20 字（0 = 還原「第 N 層」） |
| 解凍天數 | 整數 0–30 |
| 保存天數 | 整數 0–365 |
| move 的 `itemId` / `targetShelfId` | 必填；`targetIndex` < 0 視為 0，超過視為放最後 |

為了讓「天數欄位空白」能被擋下，`CreateItemRequest` 的 `thawDays` / `keepDays` 改為 `Integer`，`null` → 400。`MoveItemRequest.targetIndex` 改為 `Integer`，`null` → 放最後。

### 2.5 拖曳索引語意
`targetIndex` = **把被拖的品項先拿掉之後**，它在目標層的最終位置（0 起算）。後端維持現行「先移除再插入」邏輯不變，**修正在前端**：計算索引時排除 `.dragging` 那張卡片。

### 2.6 層架刪除
維持現有 UI：**任何一層只要是空的，都可以左滑刪除**。刪除後重新編號；名稱若符合 `^第 \d+ 層$`（也就是預設名稱），一併改成新的位置號碼；自訂名稱不動。

### 2.7 資料庫與部署
- 正式 DB 位置：屬性 `labelmanager.data-dir`，預設 `${user.home}/LabelManager/data`，DB 檔 = `<data-dir>/labelmanager.db`。啟動時目錄不存在就建立。
- 備份：`<data-dir>/backups/`，**啟動時一次 + 每天 03:00 一次**，用 SQLite `VACUUM INTO` 產生一致性快照，保留最近 14 份。
- 範例資料只在 Spring profile `demo` 時載入；正式啟動只建立 6 個空層架。
- 預設只聽本機：`server.address=127.0.0.1`（可在設定檔改）。
- Log 寫檔：`<data-dir>/logs/label-manager.log`，按日輪替，保留 30 天。

### 2.8 不動的東西
- 純領域類別 `Item` / `Shelf` / `ShelfManager` / `StatusCounter` 目前沒被 Service 使用，**不做重構**，維持原樣與既有測試。
- 不改 UI 外觀風格（iOS 風格沿用 `.agents/skills/ios-experience`）。
- 不加登入、列印、通知、多店。

---

## 3. 角色與檔案所有權

| 代號 | 角色 | 可以修改的檔案 |
|---|---|---|
| **T** | 測試驗證 | `src/test/**`（全部）、`docs/reports/T.md` |
| **D** | Debug | 只寫 `docs/reports/D.md`；**不改程式碼**，除非 Lead 指派某個 bug 並註明檔案 |
| **O** | 前端操作（人工 / 瀏覽器實測） | 只寫 `docs/reports/O.md` 與截圖 `docs/reports/screenshots/` |
| **C1** | API 層 | `controller/**`、`dto/**`、新增 `controller/GlobalExceptionHandler.java`、`service/NotFoundException.java` |
| **C2** | Service / 業務規則 | `service/LabelManagerService.java`、`service/NotFoundException.java` |
| **C3** | 持久層 / 設定 / 部署 | `src/main/resources/application*.properties`、`config/**`（含 `DataInitializer`、`TimeConfig`、新增的 DB 初始化與備份類別）、`LabelManagerApplication.java`、`pom.xml`、`scripts/**`、`README.md` 的「部署」段落、`.gitignore` |
| **C4** | 前端 | `src/main/resources/static/**` |

---

## 4. 執行順序

```
階段 0（可同時開）  T：T0 測試 DB 隔離 → 寫出「目標行為」測試（預期先紅燈）
                    D：逐條確認 B1–B15，找出新問題
                    O：在現況版本上跑一次操作清單，留下基準截圖
        ↓  Lead 合併 T0（從此可以安全跑 mvn test）
階段 1（可同時開）  C1、C2、C3、C4 各自分支開發
        ↓  合併順序：C3 → C1 → C2 → C4（每合併一個就跑一次 mvn clean test）
階段 2（可同時開）  T：全套測試 + 補強測試，所有紅燈轉綠
                    O：用 demo profile 跑完整操作清單
                    D：處理 T、O 回報的失敗，找根因 → Lead 轉派給 C1–C4 修
        ↓  修到 T、O 全部通過
階段 3              C3：在店內電腦實際部署；O：在店內電腦再跑一次操作清單
                    試營運 7 天（與紙本並行），D 每天看 log 有無 ERROR
```

---

## 5. 驗收標準（Definition of Done）

- [ ] `mvn clean test` 全綠，且**執行後正式 DB 檔案的修改時間不變**。
- [ ] `domain-examples.md` 第 1–5 節的 16 個案例全部有自動化測試。
- [ ] 每一支 API 的錯誤情境都回傳 2.1 節規定的狀態碼與 `{"error": ...}`，**沒有任何 500**（除了刻意模擬的）。
- [ ] 換標、新增時，把瀏覽器電腦時間調錯，寫入的解凍日仍然正確。
- [ ] 頁面開著跨過午夜（或用 `?today=` 模擬），5 分鐘內狀態與日期自動更新。
- [ ] 連點任何按鈕 5 次，只產生一次效果。
- [ ] 同層、跨層拖曳到任一位置，結果與預期一致（O 的清單全部通過）。
- [ ] 從任意資料夾雙擊 `start.bat` 啟動，看到的都是同一份資料。
- [ ] 強制關閉程式（工作管理員結束）再啟動，資料完整。
- [ ] 備份資料夾有檔案，且用備份檔能還原啟動。
- [ ] 試營運 7 天 log 無 ERROR。

---

## 6. 各 session 的開場指令

> 把對應區塊整段貼進新的 session 即可。每個 session 都要能讀到專案資料夾 `Label-Manager`。

### T — 測試驗證

```
你是 Label Manager 專案的「測試驗證」負責人（代號 T）。
先完整讀 docs/stabilization-plan.md、docs/requirements.md、docs/domain-examples.md，再讀 src/ 下所有程式碼。
你只能修改 src/test/** 與 docs/reports/T.md。在分支 fix/t-tests 工作。

階段 0：
1.【最優先，T0】目前 ApiControllerTest 會清空正式的 labelmanager.db。
  建立 src/test/resources/application.properties，讓測試使用 target/ 底下的獨立 SQLite 檔（每次測試前可刪掉重建），
  並確保測試不會載入 demo 範例資料。完成後先執行 mvn clean test，確認專案根目錄 labelmanager.db 的修改時間沒變。
  這一步做完就先 commit，回報給我合併。
2. 依 stabilization-plan.md 第 2 節的契約，寫「目標行為」測試（現在應該是紅燈）：
   - 錯誤格式與狀態碼（400/404/409，body 有 error 欄位）
   - 輸入上限（品名 30 字、天數範圍、天數 null）
   - 換標忽略 body、使用後端今天；新增時未來的 thawDate → 400
   - summary 回傳 today 欄位
   - 刪除中間層架後，預設名稱重新編號、自訂名稱不變
   - 同層移動：A,B,C 把 A 移到 targetIndex=1 → B,A,C（後端語意驗證）
   - domain-examples.md 16 個案例全部覆蓋（缺的補上）
   - 時間：用 @MockBean 或 @TestConfiguration 替換 Clock，模擬跨日
3. 在 docs/reports/T.md 列出：哪些測試紅燈、對應 stabilization-plan 的 B 編號。

階段 2（Lead 通知後）：在合併後的 main 上跑全套，補強邊界測試（並發兩個請求同時新增、移動到不存在的層架等），
所有紅燈必須轉綠；仍紅的寫進回報並附失敗訊息。
不要為了讓測試通過去改 src/main。
```

### D — Debug

```
你是 Label Manager 專案的「Debug」負責人（代號 D）。
先完整讀 docs/stabilization-plan.md，再讀 src/ 下所有程式碼。
你只能寫 docs/reports/D.md，不改程式碼（除非 Lead 明確指派）。
在 T0（測試 DB 隔離）合併之前，不准執行 mvn test；要跑程式請先備份 labelmanager.db，並把整個專案複製到另一個資料夾再執行。

階段 0：
1. 針對 stabilization-plan.md 第 1 節 B1–B15 逐條驗證：確認／推翻，附上重現步驟（curl 指令或操作步驟）與實際結果。
2. 主動找 Lead 沒列出的問題，重點方向：
   - SQLite + Hibernate 對 LocalDate 的實際儲存格式（直接用 sqlite3 看資料表），跨版本是否穩定
   - ddl-auto=update 在既有 DB 上的風險
   - 交易邊界：moveItem / deleteItem / removeShelf 中途失敗會不會留下錯亂的 sortOrder
   - 同時開兩個分頁操作的競態
   - 前端所有 fetch 的錯誤路徑
3. 每個問題給：嚴重度、根因、建議修法、應該歸哪個角色（C1/C2/C3/C4）。

階段 2：T 與 O 回報的失敗會轉給你，你負責找根因、寫出最小重現，交回 Lead 派工。
```

### O — 前端操作

```
你是 Label Manager 專案的「前端操作驗證」負責人（代號 O）。
先讀 docs/stabilization-plan.md 與 docs/requirements.md。
你只能寫 docs/reports/O.md 與 docs/reports/screenshots/。不改程式碼。
啟動前先把專案複製到另一個資料夾或備份 labelmanager.db，避免弄髒資料。
用瀏覽器（Playwright 或內建瀏覽器）實際操作 http://localhost:8080，每一項記錄：步驟、預期、實際、通過/失敗、截圖。

操作清單：
1. 開啟頁面：三色數字、今天日期、6 層架正常顯示
2. 新增品項：正常值、品名空白、品名 31 字、解凍天數清空、負數、999 → 是否被擋且有中文提示
3. 連點「確定新增」5 次 → 只新增 1 筆
4. 換標：確認後解凍日、到期日、顏色、頂部數字正確更新；連點 5 次只生效一次
5. 刪除品項：取消不刪、確定才刪；在兩個分頁中先後刪同一個品項 → 第二個分頁有合理提示並自動更新
6. 拖曳（每一項都截圖前後）：
   同層 A,B,C → 把 A 放到 C 前面，預期 B,A,C
   同層 A,B,C → 把 C 放到 A 前面，預期 C,A,B
   同層 → 放到最後
   跨層 → 放到空層、放到別層中間、放到最後
7. 層架：改名、清空名稱還原預設、名稱 21 字；新增層架；刪除有品項的層（要被擋）；刪除中間空層後名稱與編號是否一致
8. 後端停止時操作 → 有提示、畫面不會整片消失；後端恢復後自動恢復
9. 頁面停留 6 分鐘以上不操作 → 是否自動更新
10. 縮放到手機寬度（390px）檢查版面不破

階段 0 在現況版本跑一次當基準；階段 2 在合併後版本（用 demo profile 啟動）再跑一次，並比較差異。
```

### C1 — API 層

```
你是 Label Manager 專案的後端 API 層工程師（代號 C1）。
先完整讀 docs/stabilization-plan.md（特別是第 2 節契約），再讀 src/main 全部程式碼。
只能修改：controller/**、dto/**、新增 controller/GlobalExceptionHandler.java、service/NotFoundException.java（內容照計畫書第 2.2 節）。
分支：fix/c1-api。

要做的事：
1. 新增 @RestControllerAdvice GlobalExceptionHandler，照 2.1 節對應狀態碼，body 一律 {"error": "..."}；500 要 log 完整 stack trace。
2. 移除三個 Controller 的 @CrossOrigin（B10），並移除 ShelfController 內的 try/catch，交給全域處理。
3. retag 端點忽略 request body，呼叫 service 時 newThawDate 傳 null（由 service 用後端今天），today 參數照舊傳遞（B4）。
4. CreateItemRequest 的 thawDays/keepDays 改 Integer；MoveItemRequest.targetIndex 改 Integer（2.4 節）。
5. 新增 dto/SummaryResponse（2.2 節內容），StatusController 回傳它。service 端的對應方法由 C2 實作為
   `SummaryResponse getStatusSummary(LocalDate today)`；若 C2 尚未合併，先在本分支用最小改動讓編譯通過，並在回報中註明。
6. 不要寫業務規則（驗證邏輯在 C2 的 service）。
完成後 mvn clean test（T0 合併後才可以跑），在 docs/reports/C1.md 回報。
```

### C2 — Service / 業務規則

```
你是 Label Manager 專案的 Service 層工程師（代號 C2）。
先完整讀 docs/stabilization-plan.md（特別是第 2 節契約），再讀 src/main 全部程式碼與 docs/domain-examples.md。
只能修改：service/LabelManagerService.java、service/NotFoundException.java（內容照 2.2 節）。
分支：fix/c2-service。

要做的事：
1. 注入 java.time.Clock（Bean 由 C3 的 TimeConfig 提供，內容見 2.2 節），所有 LocalDate.now() 改為 LocalDate.now(clock)（B12）。
2. 所有「找不到」改丟 NotFoundException；狀態衝突丟 IllegalStateException；輸入不合法丟 IllegalArgumentException，訊息用店員看得懂的中文。
3. 依 2.4 節做完整輸入驗證（品名、層架名稱長度、天數範圍與 null、move 必填欄位），addItem 的 thawDate 不可晚於今天（B8、B4）。
4. removeShelf 刪除後重新編號，預設名稱（^第 \d+ 層$）同步改名，自訂名稱不動（B9、2.6 節）。
5. getStatusSummary 改回傳 dto.SummaryResponse（含 today）。
6. 確認 moveItem / deleteItem / removeShelf 整個在單一交易內，任何一步失敗不會留下重複或跳號的 sortOrder。
7. 保留既有的 removeLastShelf、initDefaultShelvesIfEmpty、initSampleDataIfEmpty 方法簽名（C3 會用）。
不要改 controller、前端、設定檔。完成後 mvn clean test，在 docs/reports/C2.md 回報。
```

### C3 — 持久層 / 設定 / 部署

```
你是 Label Manager 專案的持久層、設定與部署工程師（代號 C3）。
先完整讀 docs/stabilization-plan.md（特別是 2.2、2.7 節），再讀 src/main 全部程式碼與 pom.xml。
只能修改：src/main/resources/application*.properties、config/**、LabelManagerApplication.java、pom.xml、scripts/**、README.md 的部署段落、.gitignore。
分支：fix/c3-infra。

要做的事：
1. DB 路徑改為 labelmanager.data-dir（預設 ${user.home}/LabelManager/data），啟動時自動建立資料夾；DataSource 必須在目錄建立後才初始化（B2）。
2. SQLite 連線：WAL、busy_timeout=5000、foreign_keys=on，Hikari maximum-pool-size=1（B11）。請實測 xerial 驅動是否吃 URL 參數，不行就用 DataSource 設定。
3. 評估 ddl-auto：若能用 schema.sql + validate 穩定通過就改；若 SQLite dialect 驗證不穩，維持 update 並在回報說明理由。不可以造成既有資料遺失。
4. 新增 TimeConfig（內容照 2.2 節）（B12）。
5. DataInitializer：預設只呼叫 initDefaultShelvesIfEmpty；只有 profile=demo 才呼叫 initSampleDataIfEmpty。新增 application-demo.properties。
6. 備份：啟動時一次 + 每天 03:00，用 VACUUM INTO 輸出到 <data-dir>/backups/labelmanager-yyyyMMdd-HHmm.db，保留最近 14 份，失敗只記 log 不可讓程式掛掉（B13）。
7. server.address=127.0.0.1；log 寫到 <data-dir>/logs/，每日輪替保留 30 天（B15）。
8. scripts/：
   - start.bat：切換到自己所在資料夾、用 java -jar 啟動、啟動後自動開瀏覽器 http://localhost:8080；java 不存在時顯示中文提示
   - install-autostart.bat：把 start.bat 捷徑放進 Windows「啟動」資料夾
   - restore-backup.bat：列出備份、選一份還原（還原前先停止程式並備份目前檔案）
9. README 補「店內部署」與「還原備份」步驟，給不懂程式的店員看得懂。
10. 測試相關設定（src/test/resources）歸 T 負責，不要動。
完成後 mvn clean package，實際用 start.bat 從兩個不同資料夾啟動，確認看到同一份資料；在 docs/reports/C3.md 回報。
```

### C4 — 前端

```
你是 Label Manager 專案的前端工程師（代號 C4）。
先完整讀 docs/stabilization-plan.md（特別是第 2 節契約），再讀 src/main/resources/static/ 全部檔案與 .agents/skills/ios-experience/SKILL.md。
只能修改 src/main/resources/static/**。不改外觀風格、不加功能。分支：fix/c4-frontend。

要做的事：
1. 拖曳索引修正（B3、2.5 節）：targetIndex 要排除被拖曳的卡片本身計算。
2. 不再送瀏覽器日期（B4）：換標不送 body；新增品項不送 thawDate，並移除表單中的「解凍日」欄位（requirements 6.2：解凍日為今天）。
3. 頂部「今天」改顯示 /api/status/summary 回傳的 today；換標確認視窗的日期也用它。
4. 自動更新（B6）：每 5 分鐘、以及分頁重新取得焦點／visibilitychange 時重新載入；開著 modal 或拖曳中時延後。
5. 防連點（B7）：所有會呼叫 API 的按鈕在請求期間 disabled，表單送出鎖定到回應為止。
6. 前端輸入檢查（B8）：依 2.4 節上限檢查，空白或非整數直接提示，不送出。後端仍會再驗一次。
7. 錯誤處理：統一一個 api() 包裝函式，讀取 {"error"} 顯示 toast；404 時提示「資料已被其他畫面更新」並自動重新載入；
   網路中斷時保留現有畫面、顯示離線提示，恢復後自動重新載入（B14）。
8. 層架名稱輸入加 maxlength=20、品名 maxlength=30。
在 docs/reports/C4.md 回報；附上手動測過的項目。
```

---

## 7. 尚待使用者確認（Lead 先用預設值推進）

| 問題 | 目前預設 |
|---|---|
| 店內是只用那一台電腦（滑鼠）操作，還是也會用平板／手機？HTML5 拖曳在觸控裝置上基本不能用 | 只用電腦，`server.address=127.0.0.1` |
| 新增品項時是否需要手動選「解凍日」（例如補登前一天解凍的）？ | 不需要，一律今天（照 requirements） |
| 層架刪除：維持「任何空層都可左滑刪除」，還是照原需求只能刪最後一層？ | 維持現有 UI（任何空層） |
| 店內電腦是否已安裝 Java 17？ | 未安裝，C3 的 start.bat 需提示 |
