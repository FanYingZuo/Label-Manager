package com.example.labelmanager;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ItemTest {

    @Test
    @DisplayName("domain-examples 第 4 節：換標行為更新解凍日與重新計算")
    void retagUpdatesThawDateAndRecalculates() {
        // 原解凍日 10/28，解 1 放 2
        Item ham = new Item("火腿", 1, 2, LocalDate.of(2026, 10, 28));

        assertEquals(LocalDate.of(2026, 10, 29), ham.getOpenDate());
        assertEquals(LocalDate.of(2026, 10, 31), ham.getDiscardDate());

        // 10/30 換標（更新為今日）
        LocalDate newDate = LocalDate.of(2026, 10, 30);
        ham.retag(newDate);

        // 驗證換標後日期與狀態
        assertEquals(newDate, ham.getThawDate());
        assertEquals(LocalDate.of(2026, 10, 31), ham.getOpenDate());
        assertEquals(LocalDate.of(2026, 11, 2), ham.getDiscardDate());
        assertEquals(3, ham.getRemainingDays(newDate));
        assertEquals(ItemStatus.SAFE, ham.getStatus(newDate));
        assertEquals(StatusColor.GREEN, ham.getStatus(newDate).getColor());
    }
}
