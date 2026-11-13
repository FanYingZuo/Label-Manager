package com.example.labelmanager.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;

/**
 * Only accept requests that come from this computer (loopback address).
 * Phones, tablets and other PCs on the network are rejected with 403,
 * even if the server was started without --server.address=127.0.0.1.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class LocalOnlyFilter extends OncePerRequestFilter {

    static final String FORBIDDEN_MESSAGE = "僅允許本機電腦使用，請在放置系統的電腦上操作";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (isLoopback(request.getRemoteAddr())) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json;charset=UTF-8");
        response.getOutputStream().write(
                ("{\"error\":\"" + FORBIDDEN_MESSAGE + "\"}").getBytes(StandardCharsets.UTF_8));
    }

    public static boolean isLoopback(String remoteAddr) {
        if (remoteAddr == null || remoteAddr.isEmpty()) {
            return false;
        }
        try {
            // remoteAddr is an IP literal, so no DNS lookup happens here
            return InetAddress.getByName(remoteAddr).isLoopbackAddress();
        } catch (Exception e) {
            return false;
        }
    }
}
