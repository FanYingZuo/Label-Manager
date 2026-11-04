package com.example.labelmanager.controller;

import com.example.labelmanager.StatusSummary;
import com.example.labelmanager.service.LabelManagerService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/status")
@CrossOrigin
public class StatusController {

    private final LabelManagerService labelManagerService;

    public StatusController(LabelManagerService labelManagerService) {
        this.labelManagerService = labelManagerService;
    }

    @GetMapping("/summary")
    public StatusSummary getSummary(
            @RequestParam(value = "today", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
        return labelManagerService.getStatusSummary(today);
    }
}
