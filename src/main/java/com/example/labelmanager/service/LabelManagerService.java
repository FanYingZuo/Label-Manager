package com.example.labelmanager.service;

import com.example.labelmanager.DateCalculator;
import com.example.labelmanager.ItemStatus;
import com.example.labelmanager.ShelfManager;
import com.example.labelmanager.StatusColor;
import com.example.labelmanager.StatusSummary;
import com.example.labelmanager.dto.CreateItemRequest;
import com.example.labelmanager.dto.ItemResponse;
import com.example.labelmanager.dto.MoveItemRequest;
import com.example.labelmanager.dto.MoveShelfRequest;
import com.example.labelmanager.dto.ShelfResponse;
import com.example.labelmanager.dto.UpdateShelfNameRequest;
import com.example.labelmanager.entity.ItemEntity;
import com.example.labelmanager.entity.ShelfEntity;
import com.example.labelmanager.repository.ItemRepository;
import com.example.labelmanager.repository.ShelfRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@Transactional
public class LabelManagerService {

    private final ShelfRepository shelfRepository;
    private final ItemRepository itemRepository;
    private final Clock clock;

    public LabelManagerService(ShelfRepository shelfRepository, ItemRepository itemRepository, Clock clock) {
        this.shelfRepository = shelfRepository;
        this.itemRepository = itemRepository;
        this.clock = clock;
    }

    private void validateItemName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("品名不可為空");
        }
        int length = name.trim().length();
        if (length < 1 || length > 30) {
            throw new IllegalArgumentException("品名長度必須介於 1-30 字");
        }
    }

    private void validateThawDays(Integer days) {
        if (days == null) {
            throw new IllegalArgumentException("請填寫解凍天數");
        }
        if (days < 0 || days > 30) {
            throw new IllegalArgumentException("解凍天數必須介於 0-30 天");
        }
    }

    private void validateKeepDays(Integer days) {
        if (days == null) {
            throw new IllegalArgumentException("請填寫保存天數");
        }
        if (days < 0 || days > 365) {
            throw new IllegalArgumentException("保存天數必須介於 0-365 天");
        }
    }

    /** null target index means "append at the end". */
    private static int indexOrEnd(Integer index, int size) {
        return index == null ? size : index;
    }

    private void validateShelfName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("層架名稱不可為空");
        }
        int length = name.trim().length();
        if (length < 1 || length > 20) {
            throw new IllegalArgumentException("層架名稱長度必須介於 1-20 字");
        }
    }

    public void initDefaultShelvesIfEmpty() {
        if (shelfRepository.count() == 0) {
            for (int i = 1; i <= ShelfManager.DEFAULT_SHELVES_COUNT; i++) {
                shelfRepository.save(new ShelfEntity(ShelfManager.defaultShelfName(i), i));
            }
        }
    }

    public void initSampleDataIfEmpty() {
        if (shelfRepository.count() == 0) {
            initDefaultShelvesIfEmpty();
            List<ShelfEntity> shelves = shelfRepository.findAllByOrderBySortOrderAsc();
            if (!shelves.isEmpty()) {
                Long shelf1Id = shelves.get(0).getId();
                Long shelf2Id = shelves.size() > 1 ? shelves.get(1).getId() : shelf1Id;
                LocalDate today = LocalDate.now(clock);

                // 範例品項（虛構品項）
                itemRepository.save(new ItemEntity(shelf1Id, "火腿", 1, 2, today, 0));
                itemRepository.save(new ItemEntity(shelf1Id, "BBQ醬", 1, 7, today, 1));
                itemRepository.save(new ItemEntity(shelf2Id, "鹽烤鱈魚", 1, 1, today.minusDays(1), 0));
            }
        }
    }

    @Transactional(readOnly = true)
    public List<ShelfResponse> getAllShelves(LocalDate today) {
        LocalDate current = (today != null) ? today : LocalDate.now(clock);
        List<ShelfEntity> shelves = shelfRepository.findAllByOrderBySortOrderAsc();
        List<ShelfResponse> result = new ArrayList<>();

        for (ShelfEntity shelf : shelves) {
            List<ItemEntity> items = itemRepository.findByShelfIdOrderBySortOrderAsc(shelf.getId());
            List<ItemResponse> itemResponses = items.stream()
                    .map(item -> toItemResponse(item, current))
                    .toList();
            result.add(new ShelfResponse(shelf.getId(), shelf.getName(), shelf.getSortOrder(), itemResponses));
        }

        return result;
    }

    public ShelfResponse addShelf(String name) {
        int nextOrder = shelfRepository.findTopByOrderBySortOrderDesc()
                .map(s -> s.getSortOrder() + 1)
                .orElse(1);

        String shelfName;
        if (name == null || name.isBlank()) {
            shelfName = ShelfManager.defaultShelfName(nextOrder);
        } else {
            shelfName = name.trim();
            validateShelfName(shelfName);
        }

        ShelfEntity saved = shelfRepository.save(new ShelfEntity(shelfName, nextOrder));
        return new ShelfResponse(saved.getId(), saved.getName(), saved.getSortOrder(), List.of());
    }

    public void removeLastShelf() {
        ShelfEntity lastShelf = shelfRepository.findTopByOrderBySortOrderDesc()
                .orElseThrow(() -> new IllegalStateException("沒有層架可供移除"));

        long count = itemRepository.countByShelfId(lastShelf.getId());
        if (count > 0) {
            throw new IllegalStateException("該層仍有品項，不可移除");
        }

        shelfRepository.delete(lastShelf);
    }

    public void removeShelf(Long shelfId) {
        ShelfEntity shelf = shelfRepository.findById(shelfId)
                .orElseThrow(() -> new IllegalArgumentException("層架不存在: " + shelfId));

        long count = itemRepository.countByShelfId(shelfId);
        if (count > 0) {
            throw new IllegalStateException("該層仍有 " + count + " 個品項，不可移除（請先清空或移走食材）");
        }

        shelfRepository.delete(shelf);

        // 重新整理排序
        List<ShelfEntity> remaining = shelfRepository.findAllByOrderBySortOrderAsc();
        for (int i = 0; i < remaining.size(); i++) {
            ShelfEntity s = remaining.get(i);
            s.setSortOrder(i + 1);
            shelfRepository.save(s);
        }
    }

    public ShelfResponse renameShelf(Long shelfId, String newName) {
        ShelfEntity shelf = shelfRepository.findById(shelfId)
                .orElseThrow(() -> new IllegalArgumentException("層架不存在: " + shelfId));

        if (newName == null || newName.isBlank()) {
            shelf.setName(ShelfManager.defaultShelfName(shelf.getSortOrder()));
        } else {
            String trimmedName = newName.trim();
            validateShelfName(trimmedName);
            shelf.setName(trimmedName);
        }

        ShelfEntity saved = shelfRepository.save(shelf);
        List<ItemResponse> items = itemRepository.findByShelfIdOrderBySortOrderAsc(saved.getId()).stream()
                .map(item -> toItemResponse(item, LocalDate.now(clock)))
                .toList();

        return new ShelfResponse(saved.getId(), saved.getName(), saved.getSortOrder(), items);
    }

    public ItemResponse addItem(Long shelfId, CreateItemRequest request, LocalDate today) {
        ShelfEntity shelf = shelfRepository.findById(shelfId)
                .orElseThrow(() -> new IllegalArgumentException("層架不存在: " + shelfId));

        validateItemName(request.name());
        validateThawDays(request.thawDays());
        validateKeepDays(request.keepDays());

        LocalDate current = (today != null) ? today : LocalDate.now(clock);
        LocalDate thawDate = (request.thawDate() != null) ? request.thawDate() : current;

        List<ItemEntity> existing = itemRepository.findByShelfIdOrderBySortOrderAsc(shelfId);
        int nextOrder = existing.size();

        ItemEntity item = new ItemEntity(shelf.getId(), request.name().trim(), request.thawDays(), request.keepDays(), thawDate, nextOrder);
        ItemEntity saved = itemRepository.save(item);

        return toItemResponse(saved, current);
    }

    public ItemResponse retagItem(Long itemId, LocalDate newThawDate, LocalDate today) {
        ItemEntity item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("品項不存在: " + itemId));

        LocalDate current = (today != null) ? today : LocalDate.now(clock);
        LocalDate thawDate = (newThawDate != null) ? newThawDate : current;

        item.setThawDate(thawDate);
        ItemEntity saved = itemRepository.save(item);

        return toItemResponse(saved, current);
    }

    public void deleteItem(Long itemId) {
        ItemEntity item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("品項不存在: " + itemId));

        Long shelfId = item.getShelfId();
        itemRepository.delete(item);

        // 重新整理同層排序
        List<ItemEntity> remaining = itemRepository.findByShelfIdOrderBySortOrderAsc(shelfId);
        for (int i = 0; i < remaining.size(); i++) {
            ItemEntity entity = remaining.get(i);
            entity.setSortOrder(i);
            itemRepository.save(entity);
        }
    }

    public void moveShelf(MoveShelfRequest request) {
        Objects.requireNonNull(request, "Request cannot be null");
        if (request.shelfId() == null) {
            throw new IllegalArgumentException("缺少層架編號");
        }
        ShelfEntity shelf = shelfRepository.findById(request.shelfId())
                .orElseThrow(() -> new IllegalArgumentException("層架不存在: " + request.shelfId()));

        List<ShelfEntity> shelves = new ArrayList<>(shelfRepository.findAllByOrderBySortOrderAsc());
        shelves.removeIf(s -> s.getId().equals(shelf.getId()));

        int targetIndex = Math.max(0, Math.min(indexOrEnd(request.targetIndex(), shelves.size()), shelves.size()));
        shelves.add(targetIndex, shelf);

        for (int i = 0; i < shelves.size(); i++) {
            shelves.get(i).setSortOrder(i + 1);
            shelfRepository.save(shelves.get(i));
        }
    }

    public void moveItem(MoveItemRequest request) {
        Objects.requireNonNull(request, "Request cannot be null");
        if (request.itemId() == null || request.targetShelfId() == null) {
            throw new IllegalArgumentException("缺少品項或目標層架編號");
        }
        ItemEntity item = itemRepository.findById(request.itemId())
                .orElseThrow(() -> new IllegalArgumentException("品項不存在: " + request.itemId()));

        shelfRepository.findById(request.targetShelfId())
                .orElseThrow(() -> new IllegalArgumentException("目標層架不存在: " + request.targetShelfId()));

        Long sourceShelfId = item.getShelfId();
        Long targetShelfId = request.targetShelfId();

        if (sourceShelfId.equals(targetShelfId)) {
            List<ItemEntity> items = new ArrayList<>(itemRepository.findByShelfIdOrderBySortOrderAsc(sourceShelfId));
            items.removeIf(i -> i.getId().equals(item.getId()));

            int targetIndex = Math.max(0, Math.min(indexOrEnd(request.targetIndex(), items.size()), items.size()));
            items.add(targetIndex, item);

            for (int i = 0; i < items.size(); i++) {
                items.get(i).setSortOrder(i);
                itemRepository.save(items.get(i));
            }
        } else {
            List<ItemEntity> sourceItems = new ArrayList<>(itemRepository.findByShelfIdOrderBySortOrderAsc(sourceShelfId));
            sourceItems.removeIf(i -> i.getId().equals(item.getId()));
            for (int i = 0; i < sourceItems.size(); i++) {
                sourceItems.get(i).setSortOrder(i);
                itemRepository.save(sourceItems.get(i));
            }

            List<ItemEntity> targetItems = new ArrayList<>(itemRepository.findByShelfIdOrderBySortOrderAsc(targetShelfId));
            item.setShelfId(targetShelfId);

            int targetIndex = Math.max(0, Math.min(indexOrEnd(request.targetIndex(), targetItems.size()), targetItems.size()));
            targetItems.add(targetIndex, item);

            for (int i = 0; i < targetItems.size(); i++) {
                targetItems.get(i).setSortOrder(i);
                itemRepository.save(targetItems.get(i));
            }
        }
    }

    @Transactional(readOnly = true)
    public StatusSummary getStatusSummary(LocalDate today) {
        LocalDate current = (today != null) ? today : LocalDate.now(clock);
        List<ItemEntity> allItems = itemRepository.findAll();

        int green = 0;
        int yellow = 0;
        int red = 0;

        for (ItemEntity item : allItems) {
            LocalDate discardDate = DateCalculator.discardDate(item.getThawDate(), item.getThawDays(), item.getKeepDays());
            long remaining = DateCalculator.remainingDays(discardDate, current);
            ItemStatus status = ItemStatus.fromRemainingDays(remaining);
            switch (status.getColor()) {
                case GREEN -> green++;
                case YELLOW -> yellow++;
                case RED -> red++;
            }
        }

        return new StatusSummary(green, yellow, red);
    }

    private ItemResponse toItemResponse(ItemEntity entity, LocalDate today) {
        LocalDate openDate = DateCalculator.openDate(entity.getThawDate(), entity.getThawDays());
        LocalDate discardDate = DateCalculator.discardDate(entity.getThawDate(), entity.getThawDays(), entity.getKeepDays());
        long remainingDays = DateCalculator.remainingDays(discardDate, today);
        ItemStatus status = ItemStatus.fromRemainingDays(remainingDays);

        return new ItemResponse(
                entity.getId(),
                entity.getShelfId(),
                entity.getName(),
                entity.getThawDays(),
                entity.getKeepDays(),
                entity.getThawDate(),
                openDate,
                discardDate,
                remainingDays,
                status.name(),
                ItemStatus.formatDisplayText(remainingDays),
                status.getColor().name(),
                entity.getSortOrder()
        );
    }
}
