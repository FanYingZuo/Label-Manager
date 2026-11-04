package com.example.labelmanager.dto;

import java.util.List;

public record ShelfResponse(
        Long id,
        String name,
        int sortOrder,
        List<ItemResponse> items
) {
}
