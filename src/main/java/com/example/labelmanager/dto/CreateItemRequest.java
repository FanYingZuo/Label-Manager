package com.example.labelmanager.dto;

import java.time.LocalDate;

public record CreateItemRequest(
        String name,
        int thawDays,
        int keepDays,
        LocalDate thawDate
) {
}
