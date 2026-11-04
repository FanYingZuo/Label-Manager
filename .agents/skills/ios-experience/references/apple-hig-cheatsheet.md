# Apple Human Interface Guidelines (HIG) Web Cheatsheet

本速查表整理了將 iOS / iPhone 原生體驗轉換為 Web 前端（HTML / CSS / Tailwind CSS）的具體對應數值與最佳實踐。

---

## 1. 色彩與深色模式對應（Color Tokens）

| 語意角色 | 亮色模式 (Light) | 深色模式 (Dark) | 典型用途 |
|---|---|---|---|
| **System Background** | `#F2F2F7` | `#000000` | 頁面整體底色 |
| **Secondary Background** | `#FFFFFF` | `#1C1C1E` | 群組卡片、列表容器底色 |
| **Tertiary Background** | `#FFFFFF` | `#2C2C2E` | 卡片內嵌套元素、輸入框 |
| **System Blue** | `#007AFF` | `#0A84FF` | 主按鈕、重點強調、選中狀態 |
| **System Green** | `#34C759` | `#30D158` | 安全、成功、確認狀態 |
| **System Yellow** | `#FFCC00` | `#FFD60A` | 即將到期、警告狀態 |
| **System Red** | `#FF3B30` | `#FF453A` | 過期、危險刪除動作 |
| **Primary Label** | `#000000` | `#FFFFFF` | 主標題、重點文字 |
| **Secondary Label** | `#3C3C43` (60%) | `#EBEBF5` (60%) | 副標題、補充描述 |
| **Separator** | `rgba(60, 60, 67, 0.18)` | `rgba(84, 84, 88, 0.35)` | 列表分隔線（0.5px） |

---

## 2. 標題與字體階層（Typography Hierarchy）

| 角色 | 大小 (Size) | 行高 (Line Height) | 字重 (Weight) | 字距 (Tracking) |
|---|---|---|---|---|
| **Large Title** | 34px | 41px | 700 (Bold) | -0.4px |
| **Title 1** | 28px | 34px | 700 (Bold) | -0.2px |
| **Title 2** | 22px | 28px | 600 (Semi-Bold) | 0.35px |
| **Title 3** | 20px | 25px | 600 (Semi-Bold) | 0.38px |
| **Headline** | 17px | 22px | 600 (Semi-Bold) | -0.4px |
| **Body** | 17px | 22px | 400 (Regular) | -0.4px |
| **Callout** | 16px | 21px | 400 (Regular) | -0.3px |
| **Subheadline** | 15px | 20px | 400 (Regular) | -0.2px |
| **Footnote** | 13px | 18px | 400 (Regular) | -0.08px |
| **Caption 1** | 12px | 16px | 400 (Regular) | 0px |
| **Caption 2** | 11px | 13px | 400 (Regular) | 0.07px |

---

## 3. Tailwind CSS 速查對應（Tailwind Class Mapping）

若專案採用 Tailwind CSS，可直接套用以下實用組合：

### 3.1 毛玻璃置頂導航列
```html
<header class="sticky top-0 z-50 backdrop-blur-xl bg-white/75 dark:bg-zinc-900/75 border-b border-black/10 dark:border-white/10 pt-[env(safe-area-inset-top)]">
  <div class="max-w-4xl mx-auto h-11 px-4 flex items-center justify-between">
    <!-- 導航內容 -->
  </div>
</header>
```

### 3.2 原生觸控回饋按鈕
```html
<!-- 主按鈕 (Primary Button) -->
<button class="w-full py-3 px-5 rounded-2xl bg-[#007AFF] text-white font-semibold text-[17px] shadow-sm select-none transition-all duration-150 ease-[cubic-bezier(0.25,1,0.5,1)] active:scale-[0.96] active:opacity-90 active:bg-[#0062CC]">
  確認送出
</button>

<!-- 次按鈕 (Secondary Button) -->
<button class="w-full py-3 px-5 rounded-2xl bg-zinc-200/80 dark:bg-zinc-800 text-[#007AFF] font-semibold text-[17px] select-none transition-all duration-150 ease-[cubic-bezier(0.25,1,0.5,1)] active:scale-[0.96] active:opacity-75">
  取消
</button>
```

### 3.3 群組圓角卡片列表 (Grouped List)
```html
<div class="rounded-2xl bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/80 dark:border-zinc-700/60 divide-y divide-zinc-200/80 dark:divide-zinc-700/60 overflow-hidden">
  <div class="p-4 flex items-center justify-between active:bg-black/5 dark:active:bg-white/5 transition-colors">
    <!-- 項目 -->
  </div>
</div>
```

---

## 4. 視口與安全區域配置（Viewport & Safe Areas）

行動網頁務必在 `<head>` 宣告 `viewport-fit=cover`：
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

CSS 安全區域變數運用：
```css
/* 避開瀏海 / 動態島 */
padding-top: env(safe-area-inset-top);

/* 避開底部 Home 條 (Home Indicator) */
padding-bottom: env(safe-area-inset-bottom);
```
