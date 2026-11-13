package com.example.labelmanager.dto;

import java.time.LocalDate;

public record CreateItemRequest(
        String name,
        Integer thawDays,
        Integer keepDays,
        LocalDate thawDate
) {
}
