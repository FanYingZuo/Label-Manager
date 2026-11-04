package com.example.labelmanager;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public class DateCalculator {

    public static LocalDate openDate(LocalDate thawDate, int thawDays) {
        return thawDate.plusDays(thawDays);
    }

    public static LocalDate discardDate(LocalDate thawDate, int thawDays, int keepDays) {
        return openDate(thawDate, thawDays).plusDays(keepDays);
    }

    public static long remainingDays(LocalDate discardDate, LocalDate today) {
        return ChronoUnit.DAYS.between(today, discardDate);
    }
}
