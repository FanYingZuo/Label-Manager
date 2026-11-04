package com.example.labelmanager;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ItemStatusTest {

    @ParameterizedTest(name = "剩餘天數={0} => 預期狀態={1}, 預期顯示={2}, 預期顏色={3}")
    @CsvSource({
            "3, SAFE, 還有 3 天, GREEN",
            "2, SAFE, 還有 2 天, GREEN",
            "1, EXPIRING_SOON, 剩 1 天, YELLOW",
            "0, DISCARD_TODAY, 今天丟棄, RED",
            "-1, EXPIRED, 已過期, RED",
            "-92, EXPIRED, 已過期, RED"
    })
    @DisplayName("domain-examples 第 2 節：狀態判斷、顯示文字與顏色")
    void statusDetermination(long remainingDays, ItemStatus expectedStatus, String expectedText, StatusColor expectedColor) {
        ItemStatus actualStatus = ItemStatus.fromRemainingDays(remainingDays);
        assertEquals(expectedStatus, actualStatus);
        assertEquals(expectedColor, actualStatus.getColor());
        assertEquals(expectedText, ItemStatus.formatDisplayText(remainingDays));
    }
}
