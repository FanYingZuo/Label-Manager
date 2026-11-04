package com.example.labelmanager;

public enum ItemStatus {
    SAFE("安全", StatusColor.GREEN),
    EXPIRING_SOON("即將到期", StatusColor.YELLOW),
    DISCARD_TODAY("今天丟棄", StatusColor.RED),
    EXPIRED("已過期", StatusColor.RED);

    private final String description;
    private final StatusColor color;

    ItemStatus(String description, StatusColor color) {
        this.description = description;
        this.color = color;
    }

    public String getDescription() {
        return description;
    }

    public StatusColor getColor() {
        return color;
    }

    public static ItemStatus fromRemainingDays(long remainingDays) {
        if (remainingDays >= 2) {
            return SAFE;
        } else if (remainingDays == 1) {
            return EXPIRING_SOON;
        } else if (remainingDays == 0) {
            return DISCARD_TODAY;
        } else {
            return EXPIRED;
        }
    }

    public static String formatDisplayText(long remainingDays) {
        if (remainingDays >= 2) {
            return "還有 " + remainingDays + " 天";
        } else if (remainingDays == 1) {
            return "剩 1 天";
        } else if (remainingDays == 0) {
            return "今天丟棄";
        } else {
            return "已過期";
        }
    }
}
