# 部署指南：公司有防火牆的電腦

> 目標：在**不能上網、不能裝軟體、有防火牆**的公司／店內電腦上跑起本系統。
> 原則：**在自己的電腦打包好，用隨身碟整包帶過去，現場不需要網路、不需要 Maven、不需要安裝 Java。**

---

## 0. 先確認（跟 IT 或店長確認）

| 問題 | 影響 |
|---|---|
| 只有這一台電腦要用？還是店內其他電腦／平板也要連？ | 只有本機 → **不用開防火牆**（第 4.1 節）；多台 → 需請 IT 開放埠號（第 4.2 節） |
| 能不能執行 `.bat` 檔？ | 不能的話改用第 6 節的替代方式 |
| 有沒有防毒／應用程式白名單（AppLocker、Defender ASR）？ | 可能需要 IT 把資料夾加入白名單 |
| 8080 埠有沒有被其他程式佔用？ | 有的話換埠號（第 5 節） |

## 1. 在「自己的電腦」（可上網）準備部署包

### 1.1 打包程式

```powershell
cd Label-Manager
mvn package            # 會跑全部測試，產出 target\label-manager-0.1.0-SNAPSHOT.jar
```

### 1.2 準備可攜式 Java（不需在公司電腦安裝）

1. 下載 **Eclipse Temurin JRE 17（或 21）Windows x64 的 `.zip` 版**（不要 `.msi` 安裝版）：https://adoptium.net/temurin/releases/
2. 解壓縮，把資料夾改名為 `jre`（裡面要有 `bin\java.exe`）。

`start.bat` 會**優先使用同資料夾下的 `jre\bin\java.exe`**，找不到才用系統的 `java`。

### 1.3 組成部署資料夾

```
LabelManager\
├── start.bat
├── label-manager-0.1.0-SNAPSHOT.jar      ← 從 target\ 複製
└── jre\                                   ← 可攜式 Java
    └── bin\java.exe
```

> 資料庫 `labelmanager.db` 會在第一次啟動時自動建立在這個資料夾裡。**不要**把自己電腦上的測試資料庫帶過去（除非是要搬移正式資料，見第 7 節）。

整個 `LabelManager` 資料夾壓成 zip 或直接複製到隨身碟。

## 2. 在「公司電腦」安裝

1. 把 `LabelManager` 資料夾放到**固定、非同步的位置**，建議：`C:\LabelManager` 或 `D:\LabelManager`。
   - ❌ 不要放桌面、OneDrive、網路磁碟：同步軟體會鎖檔或衝突，SQLite 可能損壞。
   - ❌ 不要放 `C:\Program Files`：一般使用者沒有寫入權限，資料庫建不起來。
2. 若是從網路或 zip 解壓，Windows 可能標記為「來自網際網路」：對 `start.bat` 按右鍵 → 內容 → 勾選「**解除封鎖**」→ 確定。
3. 雙擊 `start.bat`，看到 `Started LabelManagerApplication` 就成功了。
4. 打開瀏覽器輸入 **http://localhost:8080**。

> 公司 Proxy 不影響：`localhost` 不經過 Proxy。如果瀏覽器硬要走 Proxy 打不開，請 IT 在 Proxy 例外清單加入 `localhost;127.0.0.1`。

## 3. 開機自動啟動

1. 按 `Win + R`，輸入 `shell:startup`，按 Enter。
2. 對 `C:\LabelManager\start.bat` 按右鍵 → 建立捷徑 → 把捷徑拖進剛剛打開的「啟動」資料夾。
3. 另外在桌面建一個瀏覽器捷徑指向 `http://localhost:8080`，命名「標籤管理」。

## 4. 防火牆設定

### 4.1 只有本機使用（建議，最安全）

讓程式**只聽本機**，外面完全連不進來，Windows 防火牆也不會跳出詢問視窗，**不需要 IT 開任何規則**。

`start.bat` **預設就是這個設定**，啟動行已帶 `--server.address=127.0.0.1`，不用改：

```bat
%JAVA% -jar label-manager-0.1.0-SNAPSHOT.jar --server.address=127.0.0.1
```

> 第一次啟動若仍跳出「Windows 安全性警訊／允許 Java 存取網路」：直接按**取消**即可，本機使用不受影響。

### 4.2 店內其他電腦／平板也要連

1. 編輯 `start.bat` 啟動行，**刪掉** `--server.address=127.0.0.1`（或改成這台電腦的內網 IP）。
2. 請 IT（需系統管理員權限）新增**只限內網**的輸入規則：

```powershell
# 以系統管理員身分執行 PowerShell
New-NetFirewallRule -DisplayName "Label Manager 8080" -Direction Inbound `
  -Protocol TCP -LocalPort 8080 -Action Allow -Profile Domain,Private `
  -RemoteAddress LocalSubnet
```

3. 查這台電腦的 IP：`ipconfig` → 「IPv4 位址」，例如 `192.168.1.20`。
4. 其他裝置瀏覽器輸入 `http://192.168.1.20:8080`。

> ⚠️ 本系統**沒有登入功能**。開放給內網後，同網段的任何人都能修改資料。不要開放 `Public` 設定檔，也不要做對外的埠轉發。

### 4.3 移除規則

```powershell
Remove-NetFirewallRule -DisplayName "Label Manager 8080"
```

## 5. 8080 埠被佔用

症狀：黑色視窗出現 `Port 8080 was already in use`。

```powershell
netstat -ano | findstr :8080        # 查是哪個程式佔用
```

改用其他埠，例如 18090：`start.bat` 啟動行加 `--server.port=18090`，網址改為 `http://localhost:18090`（防火牆規則的埠號也要一起改）。

## 6. 不能執行 .bat 的電腦

- 請 IT 把 `C:\LabelManager` 加入應用程式白名單，或
- 建立捷徑，目標填：`C:\LabelManager\jre\bin\java.exe -jar C:\LabelManager\label-manager-0.1.0-SNAPSHOT.jar --server.address=127.0.0.1`，「開始位置」填 `C:\LabelManager`（**一定要填**，資料庫會建在開始位置）。

## 7. 備份、搬移與還原

資料全部在 `labelmanager.db`（運作中還會有 `labelmanager.db-wal`、`labelmanager.db-shm`）。

| 動作 | 步驟 |
|---|---|
| 備份 | **先關閉**黑色視窗 → 把三個 `labelmanager.db*` 檔複製到隨身碟或其他資料夾（檔名加日期）|
| 搬到新電腦 | 新電腦照第 1–2 節裝好 → 先不要啟動 → 把備份的 `labelmanager.db*` 放進資料夾 → 啟動 |
| 還原 | 關閉程式 → 用備份檔覆蓋 → 啟動 |

> 分頁設定存在瀏覽器（localStorage），不在資料庫內；換電腦後分頁會回到預設，品項與層架資料不受影響。

## 8. 更新到新版本

1. 在自己的電腦 `git pull` → `mvn package`。
2. 公司電腦：關閉黑色視窗 → **先備份資料庫**（第 7 節）→ 只替換 `label-manager-0.1.0-SNAPSHOT.jar` → 重新啟動。
3. `jre` 資料夾與資料庫不用動。

## 9. 部署後檢查清單

- [ ] 瀏覽器打開 `http://localhost:8080` 看得到層架
- [ ] 新增一個測試品項 → 換標 → 刪除，都正常
- [ ] 切換日夜模式，重新整理後維持
- [ ] 關閉黑色視窗再開，資料還在
- [ ] 重開機後系統自動啟動
- [ ] （多台使用時）其他裝置用 IP 連得上，外部網路連不上
- [ ] 資料夾不在 OneDrive／桌面／網路磁碟
