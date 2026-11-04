package com.example.labelmanager;

import com.example.labelmanager.dto.CreateItemRequest;
import com.example.labelmanager.dto.MoveItemRequest;
import com.example.labelmanager.dto.UpdateShelfNameRequest;
import com.example.labelmanager.repository.ItemRepository;
import com.example.labelmanager.repository.ShelfRepository;
import com.example.labelmanager.service.LabelManagerService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class ApiControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ShelfRepository shelfRepository;

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private LabelManagerService labelManagerService;

    @BeforeEach
    void setUp() {
        itemRepository.deleteAll();
        shelfRepository.deleteAll();
        labelManagerService.initDefaultShelvesIfEmpty();
    }

    @Test
    @DisplayName("API: 取得預設 6 個層架")
    void testGetDefaultShelves() throws Exception {
        mockMvc.perform(get("/api/shelves"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(6)))
                .andExpect(jsonPath("$[0].name", is("第 1 層")))
                .andExpect(jsonPath("$[5].name", is("第 6 層")));
    }

    @Test
    @DisplayName("API: 在第 1 層新增品項並驗證日期與狀態計算")
    void testAddItemAndDateCalculation() throws Exception {
        Long shelf1Id = shelfRepository.findAllByOrderBySortOrderAsc().get(0).getId();

        CreateItemRequest request = new CreateItemRequest("火腿", 1, 2, LocalDate.of(2026, 10, 28));

        mockMvc.perform(post("/api/shelves/" + shelf1Id + "/items")
                        .param("today", "2026-10-28")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name", is("火腿")))
                .andExpect(jsonPath("$.openDate", is("2026-10-29")))
                .andExpect(jsonPath("$.discardDate", is("2026-10-31")))
                .andExpect(jsonPath("$.remainingDays", is(3)))
                .andExpect(jsonPath("$.statusText", is("還有 3 天")))
                .andExpect(jsonPath("$.statusColor", is("GREEN")));
    }

    @Test
    @DisplayName("API: 驗證頂部狀態統計 (對應 domain-examples 第 3 節)")
    void testStatusSummary() throws Exception {
        Long shelf1Id = shelfRepository.findAllByOrderBySortOrderAsc().get(0).getId();

        // 火腿: 10/28 解1放2 => 丟棄 10/31
        mockMvc.perform(post("/api/shelves/" + shelf1Id + "/items")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateItemRequest("火腿", 1, 2, LocalDate.of(2026, 10, 28)))));

        // BBQ醬: 10/28 解1放7 => 丟棄 11/05
        mockMvc.perform(post("/api/shelves/" + shelf1Id + "/items")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateItemRequest("BBQ醬", 1, 7, LocalDate.of(2026, 10, 28)))));

        // 鹽烤鱈魚: 07/29 解1放1 => 丟棄 07/31
        mockMvc.perform(post("/api/shelves/" + shelf1Id + "/items")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateItemRequest("鹽烤鱈魚", 1, 1, LocalDate.of(2026, 7, 29)))));

        // 今天為 10/31 => 預期綠 1, 黃 0, 紅 2
        mockMvc.perform(get("/api/status/summary")
                        .param("today", "2026-10-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.green", is(1)))
                .andExpect(jsonPath("$.yellow", is(0)))
                .andExpect(jsonPath("$.red", is(2)));
    }

    @Test
    @DisplayName("API: 換標行為 (對應 domain-examples 第 4 節)")
    void testRetag() throws Exception {
        Long shelf1Id = shelfRepository.findAllByOrderBySortOrderAsc().get(0).getSortOrder() == 1
                ? shelfRepository.findAllByOrderBySortOrderAsc().get(0).getId() : 1L;

        MvcResult result = mockMvc.perform(post("/api/shelves/" + shelf1Id + "/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateItemRequest("火腿", 1, 2, LocalDate.of(2026, 10, 28)))))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode jsonNode = objectMapper.readTree(result.getResponse().getContentAsString());
        long itemId = jsonNode.get("id").asLong();

        // 10/30 換標
        mockMvc.perform(put("/api/items/" + itemId + "/retag")
                        .param("today", "2026-10-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.thawDate", is("2026-10-30")))
                .andExpect(jsonPath("$.openDate", is("2026-10-31")))
                .andExpect(jsonPath("$.discardDate", is("2026-11-02")))
                .andExpect(jsonPath("$.remainingDays", is(3)))
                .andExpect(jsonPath("$.statusColor", is("GREEN")));
    }

    @Test
    @DisplayName("API: 移除最後一層防護 (有品項時拒絕，空層時允許)")
    void testRemoveLastShelfProtection() throws Exception {
        var shelves = shelfRepository.findAllByOrderBySortOrderAsc();
        Long lastShelfId = shelves.get(shelves.size() - 1).getId();

        // 在最後一層加品項
        mockMvc.perform(post("/api/shelves/" + lastShelfId + "/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateItemRequest("測試品項", 0, 1, LocalDate.now()))))
                .andExpect(status().isCreated());

        // 嘗試移除最後一層 => 應被拒絕 400
        mockMvc.perform(delete("/api/shelves/last"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("該層仍有品項")));

        // 刪除該品項
        var item = itemRepository.findByShelfIdOrderBySortOrderAsc(lastShelfId).get(0);
        mockMvc.perform(delete("/api/items/" + item.getId()))
                .andExpect(status().isNoContent());

        // 再次移除最後一層 => 成功 204
        mockMvc.perform(delete("/api/shelves/last"))
                .andExpect(status().isNoContent());

        assertEquals(5, shelfRepository.count());
    }

    @Test
    @DisplayName("API: 跨層移動品項 (對應 domain-examples 第 5 節 #14)")
    void testMoveItemAcrossShelves() throws Exception {
        var shelves = shelfRepository.findAllByOrderBySortOrderAsc();
        Long shelf1Id = shelves.get(0).getId();
        Long shelf2Id = shelves.get(1).getId();

        MvcResult resultA = mockMvc.perform(post("/api/shelves/" + shelf1Id + "/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateItemRequest("A", 1, 1, LocalDate.now()))))
                .andReturn();
        long itemAId = objectMapper.readTree(resultA.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(post("/api/shelves/" + shelf1Id + "/items")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateItemRequest("B", 1, 1, LocalDate.now()))));

        // 把 A 從第 1 層移到第 2 層 index 0
        MoveItemRequest moveRequest = new MoveItemRequest(itemAId, shelf2Id, 0);
        mockMvc.perform(put("/api/items/move")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(moveRequest)))
                .andExpect(status().isOk());

        // 驗證第 1 層只剩 B，第 2 層有 A
        assertEquals(1, itemRepository.findByShelfIdOrderBySortOrderAsc(shelf1Id).size());
        assertEquals("B", itemRepository.findByShelfIdOrderBySortOrderAsc(shelf1Id).get(0).getName());
        assertEquals(1, itemRepository.findByShelfIdOrderBySortOrderAsc(shelf2Id).size());
        assertEquals("A", itemRepository.findByShelfIdOrderBySortOrderAsc(shelf2Id).get(0).getName());
    }

    @Test
    @DisplayName("API: 編輯層架名稱與空名稱回退")
    void testRenameShelf() throws Exception {
        var shelves = shelfRepository.findAllByOrderBySortOrderAsc();
        Long shelf1Id = shelves.get(0).getId();

        mockMvc.perform(put("/api/shelves/" + shelf1Id + "/name")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateShelfNameRequest("肉品冷凍區"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", is("肉品冷凍區")));

        // 留空自動還原「第 1 層」
        mockMvc.perform(put("/api/shelves/" + shelf1Id + "/name")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateShelfNameRequest("   "))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", is("第 1 層")));
    }
}
