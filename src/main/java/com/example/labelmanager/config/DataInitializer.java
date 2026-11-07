package com.example.labelmanager.config;

import com.example.labelmanager.service.LabelManagerService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements ApplicationRunner {

    private final LabelManagerService labelManagerService;

    public DataInitializer(LabelManagerService labelManagerService) {
        this.labelManagerService = labelManagerService;
    }

    @Override
    public void run(ApplicationArguments args) {
        labelManagerService.initDefaultShelvesIfEmpty();
    }
}
