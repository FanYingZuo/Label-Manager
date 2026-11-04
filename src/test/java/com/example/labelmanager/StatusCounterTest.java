package com.example.labelmanager;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class StatusCounterTest {

    @Test
    @DisplayName("domain-examples 第 3 節：狀態統計（頂部三個數字）")
    void countStatusSummaryMatchesExample() {
        LocalDate today = LocalDate.of(2026, 10, 31);

        Item ham = new Item("火腿", 1, 2, LocalDate.of(2026, 10, 28)); // 丟棄 10/31 => 剩 0 天 => 今天丟棄 (紅)
        Item bbq = new Item("BBQ醬", 1, 7, LocalDate.of(2026, 10, 28)); // 丟棄 11/05 => 剩 5 天 => 安全 (綠)
        Item cod = new Item("鹽烤鱈魚", 1, 1, LocalDate.of(2026, 7, 29)); // 丟棄 07/31 => 剩 -92 天 => 已過期 (紅)

        StatusSummary summary = StatusCounter.count(List.of(ham, bbq, cod), today);

        // 預期綠色 1，預期黃色 0，預期紅色 2
        assertEquals(1, summary.green());
        assertEquals(0, summary.yellow());
        assertEquals(2, summary.red());
    }

    @Test
    @DisplayName("狀態統計包含黃色（剩 1 天）品項")
    void countStatusSummaryWithYellow() {
        LocalDate today = LocalDate.of(2026, 10, 30);

        Item ham = new Item("火腿", 1, 2, LocalDate.of(2026, 10, 28)); // 丟棄 10/31 => 剩 1 天 => 剩 1 天 (黃)
        Item bbq = new Item("BBQ醬", 1, 7, LocalDate.of(2026, 10, 28)); // 丟棄 11/05 => 剩 6 天 => 安全 (綠)
        Item cod = new Item("鹽烤鱈魚", 1, 1, LocalDate.of(2026, 7, 29)); // 丟棄 07/31 => 已過期 (紅)

        StatusSummary summary = StatusCounter.count(List.of(ham, bbq, cod), today);

        assertEquals(1, summary.green());
        assertEquals(1, summary.yellow());
        assertEquals(1, summary.red());
    }
}
