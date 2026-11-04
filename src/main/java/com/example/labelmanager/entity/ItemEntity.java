package com.example.labelmanager.entity;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "items")
public class ItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long shelfId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private int thawDays;

    @Column(nullable = false)
    private int keepDays;

    @Column(nullable = false)
    private LocalDate thawDate;

    @Column(nullable = false)
    private int sortOrder;

    public ItemEntity() {
    }

    public ItemEntity(Long shelfId, String name, int thawDays, int keepDays, LocalDate thawDate, int sortOrder) {
        this.shelfId = shelfId;
        this.name = name;
        this.thawDays = thawDays;
        this.keepDays = keepDays;
        this.thawDate = thawDate;
        this.sortOrder = sortOrder;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getShelfId() {
        return shelfId;
    }

    public void setShelfId(Long shelfId) {
        this.shelfId = shelfId;
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
        this.thawDays = thawDays;
    }

    public int getKeepDays() {
        return keepDays;
    }

    public void setKeepDays(int keepDays) {
        this.keepDays = keepDays;
    }

    public LocalDate getThawDate() {
        return thawDate;
    }

    public void setThawDate(LocalDate thawDate) {
        this.thawDate = thawDate;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }
}
