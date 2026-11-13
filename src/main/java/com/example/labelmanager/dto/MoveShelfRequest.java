package com.example.labelmanager.dto;

public record MoveShelfRequest(
        Long shelfId,
        Integer targetIndex
) {
}
