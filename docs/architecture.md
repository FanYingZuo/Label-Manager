# 系統架構說明（Architecture Documentation）

本文件詳細說明 **Label Manager（標籤管理系統）** 的系統設計、分層架構、資料模型與核心業務邏輯流程。

---

## 1. 系統設計目標與原則

- **輕量與單機化**：專為單店設計，部署於店內單一電腦，使用者透過瀏覽器即可操作，不需繁複的帳號登入與雲端相依。
- **領域核心無依賴（Domain-Driven Design 原則）**：核心日期運算、狀態判斷與層架邏輯使用純 Java 17 實作，完全不依賴 Spring 框架或第三方函式庫，確保領域邏輯高度可測試性與高穩定度。
- **後端主導計算**：日期計算與狀態轉換一律由後端統一行使，前端僅負責展現與操作送出，防止前端時間偏差造成食材過期誤判。
- **零外部前端構建工具**：靜態資源直接由 Spring Boot 託管，無需 Node.js / npm 等額外構建環境，開箱即用。

---

## 2. 系統架構圖

```mermaid
graph TD
    subgraph 前端 (Browser Client)
        UI[單頁介面 index.html]
        JS[互動邏輯 app.js]
        CSS[現代化樣式 style.css]
        DnD[HTML5 拖曳排序]
    end

    subgraph 後端 Spring Boot (Java 17)
        Controller[REST Controllers]
        Service[LabelManagerService]
        
        subgraph 純 Java 領域模型
            DateCalc[DateCalculator 日期計算器]
            StatusJudge[ItemStatus 狀態判定與顏色]
            StatusCounter[StatusCounter 狀態統計]
            DomainShelf[Shelf & ShelfManager]
            DomainItem[Item]
        end

        Repo[Spring Data JPA Repositories]
    end

    subgraph 儲存層 (Storage)
        SQLite[(SQLite Database: labelmanager.db)]
    end

    UI -->|HTTP / REST API| Controller
    JS -->|Drag & Drop 移動請求| Controller
    Controller --> Service
    Service --> DateCalc
    Service --> StatusJudge
    Service --> StatusCounter
    Service --> Repo
    Repo --> SQLite
```

---

## 3. 分層架構說明

### 3.1 核心領域層（Domain Layer）
位於 `com.example.labelmanager`：
- `DateCalculator`：純函數計算器，計算開封日、丟棄日與剩餘天數。
- `ItemStatus` / `StatusColor`：狀態枚舉（安全、即將到期、今天丟棄、已過期）與對應三色（綠、黃、紅）。
- `Item`：品項實體，封裝品項屬性與換標行為 (`retag`)。
- `Shelf` / `ShelfManager`：層架管理實體，負責同層/跨層品項移動、防護移除等業務規則。

### 3.2 應用服務層（Service Layer）
位於 `com.example.labelmanager.service`：
- `LabelManagerService`：協調整合儲存層與領域運算，將資料庫實體轉換為包含動態計算狀態的 DTO 物件。

### 3.3 儲存持久層（Persistence Layer）
位於 `com.example.labelmanager.entity` 與 `repository`：
- `ShelfEntity`：記錄層架 ID、名稱、排序順序。
- `ItemEntity`：記錄品項 ID、所屬層架 ID、品名、解凍天數、保存天數、解凍日、同層排序。
- 採用 **SQLite** 作為輕量嵌入式關聯資料庫，搭配 Hibernate 6 (Spring Data JPA)。

### 3.4 表現層與 REST API（Controller Layer）
位於 `com.example.labelmanager.controller`：
- `GET /api/shelves`：取得所有層架與品項（含完整計算日與顏色狀態）。
- `POST /api/shelves`：新增層架。
- `DELETE /api/shelves/last`：移除最後一層（有品項時拒絕並返回提示）。
- `PUT /api/shelves/{id}/name`：編輯層架名稱（空白時自動還原為「第 N 層」）。
- `POST /api/shelves/{shelfId}/items`：新增品項至指定層架末端。
- `PUT /api/items/{id}/retag`：品項換標（解凍日更新為今日）。
- `DELETE /api/items/{id}`：刪除品項並壓縮排序。
- `PUT /api/items/move`：同層重新排序或跨層移動。
- `GET /api/status/summary`：頂部三色狀態數量統計（綠、黃、紅）。

### 3.5 前端介面（Web Client）
位於 `src/main/resources/static`：
- HTML5 Drag and Drop API 支援即時卡片拖曳與跨層移動。
- 自動反映頂部三色警示數字。
- 點選換標與新增品項彈窗。

---

## 4. 業務規則與計算公式

| 概念 | 計算公式 | 說明 |
|---|---|---|
| 開封日 | `解凍日 + 解凍天數` | 解凍天數允許為 0 |
| 丟棄日 | `開封日 + 保存天數` | 系統中的食材到期日 |
| 剩餘天數 | `丟棄日 − 今天` | 以日曆日為精確單位 |

### 狀態判斷與三色對應：
- **安全（綠色）**：剩餘天數 $\ge 2$（顯示：`還有 N 天`）
- **即將到期（黃色）**：剩餘天數 $= 1$（顯示：`剩 1 天`）
- **今天丟棄（紅色）**：剩餘天數 $= 0$（顯示：`今天丟棄`）
- **已過期（紅色）**：剩餘天數 $< 0$（顯示：`已過期`）
