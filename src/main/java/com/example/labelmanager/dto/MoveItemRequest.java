package com.example.labelmanager.dto;

public record MoveItemRequest(
        Long itemId,
        Long targetShelfId,
        Integer targetIndex
) {
}
