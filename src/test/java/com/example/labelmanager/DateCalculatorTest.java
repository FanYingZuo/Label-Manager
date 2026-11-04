package com.example.labelmanager;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DateCalculatorTest {

    @Test
    @DisplayName("計算丟棄日：解凍日 + 解凍天數 + 保存天數")
    void discardDateIsThawDatePlusThawDaysPlusKeepDays() {
        LocalDate thawDate = LocalDate.of(2026, 10, 28);
        LocalDate expected = LocalDate.of(2026, 10, 31);

        LocalDate actual = DateCalculator.discardDate(thawDate, 1, 2);

        assertEquals(expected, actual);
    }

    @ParameterizedTest(name = "{0}: 解凍日={1}, 解={2}, 放={3} => 開封日={4}, 丟棄日={5}")
    @CsvSource({
            "火腿, 2026-10-28, 1, 2, 2026-10-29, 2026-10-31",
            "BBQ醬, 2026-10-28, 1, 7, 2026-10-29, 2026-11-05",
            "鹽烤鱈魚, 2026-07-29, 1, 1, 2026-07-30, 2026-07-31",
            "解凍天數為0, 2026-10-28, 0, 2, 2026-10-28, 2026-10-30"
    })
    @DisplayName("domain-examples 第 1 節：開封日與丟棄日計算")
    void calculateOpenAndDiscardDates(String name, LocalDate thawDate, int thawDays, int keepDays,
                                      LocalDate expectedOpenDate, LocalDate expectedDiscardDate) {
        assertEquals(expectedOpenDate, DateCalculator.openDate(thawDate, thawDays));
        assertEquals(expectedDiscardDate, DateCalculator.discardDate(thawDate, thawDays, keepDays));
    }

    @ParameterizedTest(name = "丟棄日={0}, 今天={1} => 剩餘天數={2}")
    @CsvSource({
            "2026-10-31, 2026-10-28, 3",
            "2026-10-31, 2026-10-29, 2",
            "2026-10-31, 2026-10-30, 1",
            "2026-10-31, 2026-10-31, 0",
            "2026-10-31, 2026-11-01, -1",
            "2026-07-31, 2026-10-31, -92"
    })
    @DisplayName("domain-examples 第 2 節與第 3 節：剩餘天數計算 (丟棄日 - 今天)")
    void calculateRemainingDays(LocalDate discardDate, LocalDate today, long expectedRemainingDays) {
        assertEquals(expectedRemainingDays, DateCalculator.remainingDays(discardDate, today));
    }
}
