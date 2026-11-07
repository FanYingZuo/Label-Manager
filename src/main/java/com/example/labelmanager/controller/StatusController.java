package com.example.labelmanager.controller;

import com.example.labelmanager.StatusSummary;
import com.example.labelmanager.dto.SummaryResponse;
import com.example.labelmanager.service.LabelManagerService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.Clock;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/status")
public class StatusController {

    private final LabelManagerService labelManagerService;
    private final Clock clock;

    public StatusController(LabelManagerService labelManagerService, Clock clock) {
        this.labelManagerService = labelManagerService;
        this.clock = clock;
    }

    @GetMapping("/summary")
    public SummaryResponse getSummary(
            @RequestParam(value = "today", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate today) {
        LocalDate current = (today != null) ? today : LocalDate.now(clock);
        StatusSummary summary = labelManagerService.getStatusSummary(today);
        return new SummaryResponse(summary.green(), summary.yellow(), summary.red(), current);
    }
}
