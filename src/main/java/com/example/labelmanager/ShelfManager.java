package com.example.labelmanager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public class ShelfManager {

    public static final int DEFAULT_SHELVES_COUNT = 6;
    private final List<Shelf> shelves = new ArrayList<>();

    public ShelfManager() {
        this(DEFAULT_SHELVES_COUNT);
    }

    public ShelfManager(int initialShelvesCount) {
        if (initialShelvesCount < 0) {
            throw new IllegalArgumentException("Shelf count cannot be negative");
        }
        for (int i = 0; i < initialShelvesCount; i++) {
            shelves.add(new Shelf(defaultShelfName(i + 1)));
        }
    }

    public static String defaultShelfName(int index) {
        return "第 " + index + " 層";
    }

    public List<Shelf> getShelves() {
        return Collections.unmodifiableList(shelves);
    }

    public Shelf getShelf(int index) {
        if (index < 0 || index >= shelves.size()) {
            throw new IndexOutOfBoundsException("Invalid shelf index: " + index);
        }
        return shelves.get(index);
    }

    public Shelf addShelf() {
        return addShelf(null);
    }

    public Shelf addShelf(String name) {
        int nextIndex = shelves.size() + 1;
        String actualName = (name == null || name.isBlank()) ? defaultShelfName(nextIndex) : name.trim();
        Shelf shelf = new Shelf(actualName);
        shelves.add(shelf);
        return shelf;
    }

    public Shelf removeLastShelf() {
        if (shelves.isEmpty()) {
            throw new IllegalStateException("沒有層架可供移除");
        }
        int lastIndex = shelves.size() - 1;
        Shelf lastShelf = shelves.get(lastIndex);
        if (!lastShelf.isEmpty()) {
            throw new IllegalStateException("該層仍有品項，不可移除");
        }
        return shelves.remove(lastIndex);
    }

    public void renameShelf(int index, String newName) {
        Shelf shelf = getShelf(index);
        if (newName == null || newName.isBlank()) {
            shelf.setName(defaultShelfName(index + 1));
        } else {
            shelf.setName(newName.trim());
        }
    }

    public void addItem(int shelfIndex, Item item) {
        Objects.requireNonNull(item, "Item cannot be null");
        getShelf(shelfIndex).addItem(item);
    }

    public void moveItemWithinShelf(int shelfIndex, int fromIndex, int toIndex) {
        getShelf(shelfIndex).moveItem(fromIndex, toIndex);
    }

    public void moveItemAcrossShelves(int sourceShelfIndex, int sourceItemIndex, int targetShelfIndex, int targetItemIndex) {
        Shelf sourceShelf = getShelf(sourceShelfIndex);
        Shelf targetShelf = getShelf(targetShelfIndex);
        Item item = sourceShelf.removeItem(sourceItemIndex);
        targetShelf.addItem(targetItemIndex, item);
    }

    public boolean removeItem(String itemId) {
        Objects.requireNonNull(itemId, "Item ID cannot be null");
        for (Shelf shelf : shelves) {
            if (shelf.removeItemById(itemId)) {
                return true;
            }
        }
        return false;
    }

    public Optional<Item> findItemById(String itemId) {
        Objects.requireNonNull(itemId, "Item ID cannot be null");
        return shelves.stream()
                .flatMap(shelf -> shelf.getItems().stream())
                .filter(item -> item.getId().equals(itemId))
                .findFirst();
    }

    public List<Item> getAllItems() {
        List<Item> all = new ArrayList<>();
        for (Shelf shelf : shelves) {
            all.addAll(shelf.getItems());
        }
        return all;
    }
}
