package com.example.labelmanager;

import com.example.labelmanager.config.LocalOnlyFilter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LocalOnlyFilterTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("本機位址可以存取")
    void loopbackIsAllowed() throws Exception {
        mockMvc.perform(get("/api/shelves").with(req -> { req.setRemoteAddr("127.0.0.1"); return req; }))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/shelves").with(req -> { req.setRemoteAddr("0:0:0:0:0:0:0:1"); return req; }))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("區網裝置（手機、平板、其他電腦）回 403，頁面也一樣")
    void lanDeviceIsForbidden() throws Exception {
        mockMvc.perform(get("/api/shelves").with(req -> { req.setRemoteAddr("192.168.1.20"); return req; }))
                .andExpect(status().isForbidden())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("僅允許本機電腦使用")));
        mockMvc.perform(get("/").with(req -> { req.setRemoteAddr("192.168.1.20"); return req; }))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("位址判斷：只有迴環位址為本機")
    void isLoopbackDecision() {
        assertTrue(LocalOnlyFilter.isLoopback("127.0.0.1"));
        assertTrue(LocalOnlyFilter.isLoopback("::1"));
        assertFalse(LocalOnlyFilter.isLoopback("192.168.1.20"));
        assertFalse(LocalOnlyFilter.isLoopback("10.0.0.5"));
        assertFalse(LocalOnlyFilter.isLoopback(""));
        assertFalse(LocalOnlyFilter.isLoopback(null));
    }
}
