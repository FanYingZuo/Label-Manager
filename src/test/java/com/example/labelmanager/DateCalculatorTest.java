package com.example.labelmanager;

import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import static org.junit.jupiter.api.Assertions.assertEquals;

class DateCalculatorTest {

    @Test
    void discardDateIsThawDatePlusThawDaysPlusKeepDays() {
        LocalDate thawDate = LocalDate.of(2026, 10, 28);
        LocalDate expected = LocalDate.of(2026, 10, 31);

        LocalDate actual = DateCalculator.discardDate(thawDate, 1, 2);

        assertEquals(expected, actual);
    }
}