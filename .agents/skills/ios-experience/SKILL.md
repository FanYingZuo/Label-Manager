---
name: ios-experience
description: >-
  Use this skill whenever designing, building, or styling frontend interfaces
  (HTML, CSS, Tailwind CSS, Thymeleaf, JSP, React, Vue, or web components)
  to automatically apply iPhone (iOS / Apple Human Interface Guidelines) visual aesthetics
  and native physical touch interactions.
---

# iOS Experience (iPhone 視覺與互動體驗規範)

本 Skill 指引你在建構或修改任何前端畫面（HTML、CSS、Thymeleaf、JSP 或前端元件）時，自動套用極具質感的 Apple iPhone (iOS) 原生視覺風格與物理互動體驗。

---

## 核心設計四大支柱

```
┌─────────────────────────────────────────────────────────────────┐
│                     iOS Experience Pillars                       │
├───────────────┬─────────────────┬───────────────┬───────────────┤
│ 1. 極簡與圓角 │ 2. 毛玻璃特效   │ 3. 物理動態   │ 4. 導航與排版 │
│ 大膽標題層級  │ 高斯模糊與半透明│ 輕微彈性縮放  │ 大標題/TabBar │
│ 乾淨自然留白  │ backdrop-filter │ Spring 貝茲曲線│ Safe Area Inset│
│ 標誌性連續圓角│ 雙層邊界與微光澤│ 0 延遲點擊回饋│ 觸控彈性滾動  │
└───────────────┴─────────────────┴───────────────┴───────────────┘
```

---

## 1. 極簡、留白與圓角系統（Minimalism & Radii）

### 1.1 排版字體與標題層級（Typography Hierarchy）
- **字體堆疊（Font Stack）**：優先使用系統字體，確保在 Apple 裝置上無縫調用 San Francisco：
  ```css
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  ```
- **iOS Large Title（大標題風格）**：
  ```css
  .ios-large-title {
    font-size: 34px;
    line-height: 41px;
    font-weight: 700;
    letter-spacing: -0.4px;
    color: var(--ios-label-primary, #000000);
  }
  ```
- **Section Headers（群組小節標題）**：
  ```css
  .ios-section-header {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: -0.08px;
    color: var(--ios-label-secondary, #6C6C70);
    padding: 0 16px 8px 16px;
  }
  ```

### 1.2 圓角標準（Corner Radius Scale）
iOS 採用平滑連續圓角（Squircle），請遵循以下標準尺寸：
| 元素類型 | CSS border-radius | Tailwind CSS 類別 | 備註 |
|---|---|---|---|
| 小型按鈕 / 標籤 (Chips / Badges) | `10px` ~ `12px` | `rounded-xl` | 緊湊元器件 |
| 標準按鈕 / 輸入框 (Buttons / Inputs) | `14px` ~ `16px` | `rounded-2xl` | 觸控主按鈕 |
| 卡片 / 列表群組 (Cards / Grouped Lists) | `16px` ~ `20px` | `rounded-2xl` ~ `rounded-3xl` | 典型 iOS 設定卡片 |
| 模態視窗 / 底部抽屜 (Modals / Action Sheets) | `24px` ~ `28px` | `rounded-[24px]` | 頂部圓角特徵 |

### 1.3 背景與群組架構（Grouped Backgrounds）
iOS 偏好將內容放置於淺灰底色（`#F2F2F7`）上的白色圓角卡片群組中：
- **頁面主背景**：`#F2F2F7`（深色模式：`#000000`）
- **群組卡片背景**：`#FFFFFF`（深色模式：`#1C1C1E`）
- **群組清單分割線**：`0.5px solid rgba(60, 60, 67, 0.15);`，左側保留 16px 內縮。

---

## 2. 毛玻璃特效（Frosted Glass / Glassmorphism）

在導航列（Navigation Bar）、底部分頁列（Tab Bar）、浮動工具列、模態視窗及彈出選單使用半透明 + 高斯模糊。

### 2.1 標準 iOS 毛玻璃參數
```css
/* 亮色模式 (Light Mode) */
.ios-glass {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.12);
}

/* 深色模式 (Dark Mode) */
@media (prefers-color-scheme: dark) {
  .ios-glass {
    background: rgba(28, 28, 30, 0.75);
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.15);
  }
}
```

### 2.2 浮動毛玻璃卡片（Floating Sheet / Card）
```css
.ios-glass-card {
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(25px) saturate(190%);
  -webkit-backdrop-filter: blur(25px) saturate(190%);
  border: 0.5px solid rgba(255, 255, 255, 0.6);
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 10px 25px -5px rgba(0, 0, 0, 0.08);
  border-radius: 20px;
}
```

---

## 3. 物理動態與互動（Physical Dynamics & Touch Feedback）

### 3.1 觸控回饋（Active Press Scaling）
所有可點擊元素（按鈕、卡片、列表項）**必須**具備按壓時的微小縮放回饋：
```css
/* 按鈕原生回饋 */
.ios-tappable {
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  transition: transform 0.15s cubic-bezier(0.25, 1, 0.5, 1),
              opacity 0.15s ease,
              filter 0.15s ease;
  cursor: pointer;
}

/* 按下瞬間 */
.ios-tappable:active {
  transform: scale(0.96);
  opacity: 0.85;
}

/* 次要動作 / 列表項目按下效果 */
.ios-list-row:active {
  background-color: rgba(0, 0, 0, 0.04);
}
```

### 3.2 物理動畫曲線（Spring & Fluid Motion Curves）
iOS 動畫帶有自然彈性（Fluid Springs），嚴禁生硬的 linear 或過度震盪的 bounce：
```css
:root {
  /* iOS 經典彈性轉場曲線 */
  --ios-spring-easing: cubic-bezier(0.32, 0.72, 0, 1);
  --ios-bounce-easing: cubic-bezier(0.175, 0.885, 0.32, 1.15);
  --ios-press-easing: cubic-bezier(0.25, 1, 0.5, 1);
  --ios-transition-fast: 0.2s var(--ios-spring-easing);
  --ios-transition-normal: 0.35s var(--ios-spring-easing);
}
```

---

## 4. 導航、排版與觸控捲動（Navigation & Layout）

### 4.1 頂部導航列（iOS Navigation Bar）
- 固定置頂（`position: sticky; top: 0; z-index: 50;`）
- 結合毛玻璃效果與大標題收合過渡：
```html
<header class="ios-navbar ios-glass">
  <div class="ios-navbar-content">
    <button class="ios-nav-back">‹ 返回</button>
    <div class="ios-navbar-title">標題</div>
    <div class="ios-nav-action">完成</div>
  </div>
</header>
```

### 4.2 底部分頁列（iOS Tab Bar）
- 固定底部、支援安全區域留白（`env(safe-area-inset-bottom)`）：
```css
.ios-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(50px + env(safe-area-inset-bottom, 20px));
  padding-bottom: env(safe-area-inset-bottom, 20px);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-top: 0.5px solid rgba(0, 0, 0, 0.15);
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 100;
}
```

### 4.3 觸控捲動體驗優化（Touch Scroll & Safe Areas）
```css
html, body {
  -webkit-text-size-adjust: 100%;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior-y: auto; /* 允許原生彈性回彈 */
}

.ios-scroll-container {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  padding-top: env(safe-area-inset-top);
  padding-bottom: calc(60px + env(safe-area-inset-bottom));
  padding-left: max(16px, env(safe-area-inset-left));
  padding-right: max(16px, env(safe-area-inset-right));
}
```

---

## 5. 快速套用規範清單（Implementation Checklist）

當撰寫或審查 HTML / CSS 畫面時，依此清單確認：
- [ ] **字體**：是否使用 `-apple-system, BlinkMacSystemFont` 等原生字體堆疊？
- [ ] **圓角**：卡片是否使用 `16px ~ 24px` 圓角，按鈕是否為 `12px ~ 16px`？
- [ ] **毛玻璃**：導航列或置頂列是否使用 `backdrop-filter: blur(20px)` 搭配 `rgba(255, 255, 255, 0.75)`？
- [ ] **點擊回饋**：按鈕是否有 `:active { transform: scale(0.96); }` 與平滑轉場？
- [ ] **安全區域**：底部與頂部是否妥善處理了 `env(safe-area-inset-*)`？
- [ ] **高對比分割線**：分隔線是否為細緻的 `0.5px` 或帶透明度的柔和線條？

更多詳細範例與參考資源請見：
- [CSS 元件樣式庫範例](./examples/ios-style.css)
- [iOS 風格完整示範頁面](./examples/sample-screen.html)
- [Apple HIG 設計規範速查表](./references/apple-hig-cheatsheet.md)
