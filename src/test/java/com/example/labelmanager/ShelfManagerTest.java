package com.example.labelmanager;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ShelfManagerTest {

    private final LocalDate today = LocalDate.of(2026, 10, 28);

    @Test
    @DisplayName("預設建立 6 個層架，名稱分別為第 1 層至第 6 層")
    void defaultSixShelves() {
        ShelfManager manager = new ShelfManager();
        assertEquals(6, manager.getShelves().size());
        for (int i = 0; i < 6; i++) {
            assertEquals("第 " + (i + 1) + " 層", manager.getShelf(i).getName());
            assertTrue(manager.getShelf(i).isEmpty());
        }
    }

    @Test
    @DisplayName("domain-examples #12：第 1 層已有 A、B，點「+」新增 C，順序為 A、B、C")
    void addItemAppendsToEndOfShelf() {
        ShelfManager manager = new ShelfManager();
        Item itemA = new Item("A", 1, 2, today);
        Item itemB = new Item("B", 1, 2, today);
        Item itemC = new Item("C", 1, 2, today);

        manager.addItem(0, itemA);
        manager.addItem(0, itemB);
        manager.addItem(0, itemC);

        List<Item> items = manager.getShelf(0).getItems();
        assertEquals(3, items.size());
        assertEquals(itemA, items.get(0));
        assertEquals(itemB, items.get(1));
        assertEquals(itemC, items.get(2));
    }

    @Test
    @DisplayName("domain-examples #13：第 1 層為 A、B、C，把 C 拖到 A 前面 => 順序為 C、A、B")
    void moveItemWithinSameShelf() {
        ShelfManager manager = new ShelfManager();
        Item itemA = new Item("A", 1, 2, today);
        Item itemB = new Item("B", 1, 2, today);
        Item itemC = new Item("C", 1, 2, today);

        manager.addItem(0, itemA);
        manager.addItem(0, itemB);
        manager.addItem(0, itemC);

        // 將索引 2 (C) 移動到索引 0
        manager.moveItemWithinShelf(0, 2, 0);

        List<Item> items = manager.getShelf(0).getItems();
        assertEquals(List.of(itemC, itemA, itemB), items);
    }

    @Test
    @DisplayName("domain-examples #14：第 2 層為空，把 A 從第 1 層拖到第 2 層 => 第 1 層為 B、C，第 2 層為 A")
    void moveItemAcrossShelves() {
        ShelfManager manager = new ShelfManager();
        Item itemA = new Item("A", 1, 2, today);
        Item itemB = new Item("B", 1, 2, today);
        Item itemC = new Item("C", 1, 2, today);

        manager.addItem(0, itemA);
        manager.addItem(0, itemB);
        manager.addItem(0, itemC);

        // 將第 1 層的 A (索引 0) 移動到第 2 層 (索引 1) 的位置 0
        manager.moveItemAcrossShelves(0, 0, 1, 0);

        assertEquals(List.of(itemB, itemC), manager.getShelf(0).getItems());
        assertEquals(List.of(itemA), manager.getShelf(1).getItems());
    }

    @Test
    @DisplayName("domain-examples #15：最後一層仍有品項，點「移除最後一層」=> 不允許移除，拋出異常")
    void cannotRemoveLastShelfWhenNotEmpty() {
        ShelfManager manager = new ShelfManager(3); // 建立 3 層
        Item itemA = new Item("A", 1, 2, today);
        manager.addItem(2, itemA); // 第 3 層有品項

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> manager.removeLastShelf());
        assertTrue(ex.getMessage().contains("品項"));
        assertEquals(3, manager.getShelves().size());
    }

    @Test
    @DisplayName("domain-examples #16：第 6 層為空，點「移除最後一層」=> 層架數變為 5")
    void removeLastShelfWhenEmpty() {
        ShelfManager manager = new ShelfManager(6);
        manager.removeLastShelf();
        assertEquals(5, manager.getShelves().size());
        assertEquals("第 5 層", manager.getShelf(4).getName());
    }

    @Test
    @DisplayName("新增層架與編輯層架名稱（留空時使用預設「第 N 層」）")
    void addShelfAndEditShelfName() {
        ShelfManager manager = new ShelfManager(2);
        manager.addShelf("冷藏熟食區");
        assertEquals(3, manager.getShelves().size());
        assertEquals("冷藏熟食區", manager.getShelf(2).getName());

        // 編輯名稱為自訂
        manager.renameShelf(0, "肉品區");
        assertEquals("肉品區", manager.getShelf(0).getName());

        // 留空時自動還原為「第 1 層」
        manager.renameShelf(0, "");
        assertEquals("第 1 層", manager.getShelf(0).getName());

        manager.renameShelf(0, "   ");
        assertEquals("第 1 層", manager.getShelf(0).getName());
    }
}
