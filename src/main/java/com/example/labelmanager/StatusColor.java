package com.example.labelmanager;

public enum StatusColor {
    GREEN("綠色"),
    YELLOW("黃色"),
    RED("紅色");

    private final String displayName;

    StatusColor(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
