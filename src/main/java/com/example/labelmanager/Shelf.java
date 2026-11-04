package com.example.labelmanager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public class Shelf {

    private String id;
    private String name;
    private final List<Item> items = new ArrayList<>();

    public Shelf() {
        this(UUID.randomUUID().toString(), null);
    }

    public Shelf(String name) {
        this(UUID.randomUUID().toString(), name);
    }

    public Shelf(String id, String name) {
        this.id = Objects.requireNonNull(id, "ID cannot be null");
        this.name = name;
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

    public List<Item> getItems() {
        return Collections.unmodifiableList(items);
    }

    public List<Item> getMutableItems() {
        return items;
    }

    public void addItem(Item item) {
        Objects.requireNonNull(item, "Item cannot be null");
        items.add(item);
    }

    public void addItem(int index, Item item) {
        Objects.requireNonNull(item, "Item cannot be null");
        if (index < 0 || index > items.size()) {
            throw new IndexOutOfBoundsException("Invalid index: " + index);
        }
        items.add(index, item);
    }

    public Item removeItem(int index) {
        if (index < 0 || index >= items.size()) {
            throw new IndexOutOfBoundsException("Invalid index: " + index);
        }
        return items.remove(index);
    }

    public boolean removeItem(Item item) {
        return items.remove(item);
    }

    public boolean removeItemById(String itemId) {
        return items.removeIf(item -> item.getId().equals(itemId));
    }

    public void moveItem(int fromIndex, int toIndex) {
        if (fromIndex < 0 || fromIndex >= items.size()) {
            throw new IndexOutOfBoundsException("Invalid fromIndex: " + fromIndex);
        }
        if (toIndex < 0 || toIndex >= items.size()) {
            throw new IndexOutOfBoundsException("Invalid toIndex: " + toIndex);
        }
        Item item = items.remove(fromIndex);
        items.add(toIndex, item);
    }

    public boolean isEmpty() {
        return items.isEmpty();
    }

    public int getItemCount() {
        return items.size();
    }
}
