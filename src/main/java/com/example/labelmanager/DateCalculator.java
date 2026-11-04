package com.example.labelmanager;

import java.time.LocalDate;

public class DateCalculator {

    public static LocalDate discardDate(LocalDate thawDate, int thawDays, int keepDays) {
        return thawDate.plusDays(thawDays).plusDays(keepDays);
    }
}
