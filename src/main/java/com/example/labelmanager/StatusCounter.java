package com.example.labelmanager;

import java.time.LocalDate;
import java.util.Collection;

public class StatusCounter {

    public static StatusSummary count(Collection<Item> items, LocalDate today) {
        int green = 0;
        int yellow = 0;
        int red = 0;

        if (items != null) {
            for (Item item : items) {
                ItemStatus status = item.getStatus(today);
                switch (status.getColor()) {
                    case GREEN -> green++;
                    case YELLOW -> yellow++;
                    case RED -> red++;
                }
            }
        }

        return new StatusSummary(green, yellow, red);
    }
}
