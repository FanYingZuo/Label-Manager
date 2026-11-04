package com.example.labelmanager.dto;

import java.time.LocalDate;

public record ItemResponse(
        Long id,
        Long shelfId,
        String name,
        int thawDays,
        int keepDays,
        LocalDate thawDate,
        LocalDate openDate,
        LocalDate discardDate,
        long remainingDays,
        String status,
        String statusText,
        String statusColor,
        int sortOrder
) {
}
