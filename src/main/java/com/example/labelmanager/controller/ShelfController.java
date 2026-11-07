package com.example.labelmanager.controller;

import com.example.labelmanager.dto.CreateItemRequest;
import com.example.labelmanager.dto.ItemResponse;
import com.example.labelmanager.dto.MoveShelfRequest;
import com.example.labelmanager.dto.ShelfResponse;
import com.example.labelmanager.dto.UpdateShelfNameRequest;
import com.example.labelmanager.service.LabelManagerService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/shelves")
@CrossOrigin
public class ShelfController {

    private final LabelManagerService labelManagerService;

    public ShelfController(LabelManagerService labelManagerService) {
        this.labelManagerService = labelManagerService;
    }

    @GetMapping
    public List<ShelfResponse> getAllShelves(
            @RequestParam(value = "today", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
        return labelManagerService.getAllShelves(today);
    }

    @PostMapping
    public ResponseEntity<ShelfResponse> addShelf(@RequestBody(required = false) UpdateShelfNameRequest request) {
        String name = (request != null) ? request.name() : null;
        ShelfResponse response = labelManagerService.addShelf(name);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/move")
    public ResponseEntity<?> moveShelf(@RequestBody MoveShelfRequest request) {
        labelManagerService.moveShelf(request);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/last")
    public ResponseEntity<?> removeLastShelf() {
        try {
            labelManagerService.removeLastShelf();
            return ResponseEntity.noContent().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> removeShelf(@PathVariable("id") Long id) {
        try {
            labelManagerService.removeShelf(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/name")
    public ResponseEntity<ShelfResponse> renameShelf(
            @PathVariable("id") Long id,
            @RequestBody(required = false) UpdateShelfNameRequest request) {
        String name = (request != null) ? request.name() : null;
        return ResponseEntity.ok(labelManagerService.renameShelf(id, name));
    }

    @PostMapping("/{shelfId}/items")
    public ResponseEntity<ItemResponse> addItem(
            @PathVariable("shelfId") Long shelfId,
            @RequestBody CreateItemRequest request,
            @RequestParam(value = "today", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
        ItemResponse response = labelManagerService.addItem(shelfId, request, today);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
