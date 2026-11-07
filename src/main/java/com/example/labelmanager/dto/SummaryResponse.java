package com.example.labelmanager.dto;

import java.time.LocalDate;

public record SummaryResponse(
        int green,
        int yellow,
        int red,
        LocalDate today
) {
}
