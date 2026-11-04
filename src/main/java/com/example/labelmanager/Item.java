package com.example.labelmanager;

import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

public class Item {

    private String id;
    private String name;
    private int thawDays;
    private int keepDays;
    private LocalDate thawDate;

    public Item(String name, int thawDays, int keepDays, LocalDate thawDate) {
        this(UUID.randomUUID().toString(), name, thawDays, keepDays, thawDate);
    }

    public Item(String id, String name, int thawDays, int keepDays, LocalDate thawDate) {
        this.id = Objects.requireNonNull(id, "ID cannot be null");
        this.name = Objects.requireNonNull(name, "Name cannot be null");
        if (thawDays < 0) {
            throw new IllegalArgumentException("Thaw days cannot be negative");
        }
        if (keepDays < 0) {
            throw new IllegalArgumentException("Keep days cannot be negative");
        }
        this.thawDays = thawDays;
        this.keepDays = keepDays;
        this.thawDate = Objects.requireNonNull(thawDate, "Thaw date cannot be null");
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getThawDays() {
        return thawDays;
    }

    public void setThawDays(int thawDays) {
        if (thawDays < 0) {
            throw new IllegalArgumentException("Thaw days cannot be negative");
        }
        this.thawDays = thawDays;
    }

    public int getKeepDays() {
        return keepDays;
    }

    public void setKeepDays(int keepDays) {
        if (keepDays < 0) {
            throw new IllegalArgumentException("Keep days cannot be negative");
        }
        this.keepDays = keepDays;
    }

    public LocalDate getThawDate() {
        return thawDate;
    }

    public void retag(LocalDate newThawDate) {
        this.thawDate = Objects.requireNonNull(newThawDate, "Thaw date cannot be null");
    }

    public LocalDate getOpenDate() {
        return DateCalculator.openDate(thawDate, thawDays);
    }

    public LocalDate getDiscardDate() {
        return DateCalculator.discardDate(thawDate, thawDays, keepDays);
    }

    public long getRemainingDays(LocalDate today) {
        return DateCalculator.remainingDays(getDiscardDate(), today);
    }

    public ItemStatus getStatus(LocalDate today) {
        return ItemStatus.fromRemainingDays(getRemainingDays(today));
    }
}
