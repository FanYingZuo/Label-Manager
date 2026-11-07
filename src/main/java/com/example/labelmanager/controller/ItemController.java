package com.example.labelmanager.controller;

import com.example.labelmanager.dto.ItemResponse;
import com.example.labelmanager.dto.MoveItemRequest;
import com.example.labelmanager.dto.RetagRequest;
import com.example.labelmanager.service.LabelManagerService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/items")
public class ItemController {

    private final LabelManagerService labelManagerService;

    public ItemController(LabelManagerService labelManagerService) {
        this.labelManagerService = labelManagerService;
    }

    @PutMapping("/{id}/retag")
    public ResponseEntity<ItemResponse> retagItem(
            @PathVariable("id") Long id,
            @RequestBody(required = false) RetagRequest request,
            @RequestParam(value = "today", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
        LocalDate newDate = (request != null && request.thawDate() != null) ? request.thawDate() : today;
        return ResponseEntity.ok(labelManagerService.retagItem(id, newDate, today));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable("id") Long id) {
        labelManagerService.deleteItem(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/move")
    public ResponseEntity<Void> moveItem(@RequestBody MoveItemRequest request) {
        labelManagerService.moveItem(request);
        return ResponseEntity.ok().build();
    }
}
