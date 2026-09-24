package com.enoch.conductor.ws;

import com.enoch.conductor.command.CommandMessage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WorkerSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper mapper = new ObjectMapper();

    private final Map<String, WebSocketSession> workers = new ConcurrentHashMap<>();
    private final Map<String, String> lastStatusMessages = new ConcurrentHashMap<>();
    private final Map<String, Long> lastStatusUpdatedAt = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {

        System.out.println("Worker connected");
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {

        JsonNode json = mapper.readTree(message.getPayload());

        String type = json.path("type").asText("");

        if (type.equals("REGISTER")) {

            String instanceId = json.path("instanceId").asText("");

            workers.put(instanceId, session);

            System.out.println("Registered worker: " + instanceId);
            return;
        }

        if (isStatusMessage(type)) {
            String instanceId = resolveInstanceId(json);
            String statusMessage = extractStatusMessage(json);

            if (instanceId != null && !statusMessage.isBlank()) {
                lastStatusMessages.put(instanceId, statusMessage);
                lastStatusUpdatedAt.put(instanceId, System.currentTimeMillis());
            }
        }

        if (type.equals("LOG")) {
            System.out.println("[WORKER] " + json.path("message").asText(""));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {

        workers.values().remove(session);
    }

    public boolean requestStatus(String workerId) throws Exception {

        WebSocketSession session = workers.get(workerId);

        if (session == null || !session.isOpen()) {
            return false;
        }

        CommandMessage msg = new CommandMessage();
        msg.setId(UUID.randomUUID().toString());
        msg.setType("request:status");
        msg.setFrom("conductor");
        msg.setTo(workerId);
        msg.setTimestamp(System.currentTimeMillis());
        msg.setStatus(100);

        session.sendMessage(new TextMessage(mapper.writeValueAsString(msg)));
        return true;
    }

    public String getLastStatusMessage(String workerId) {

        return lastStatusMessages.get(workerId);
    }

    public long getLastStatusUpdatedAt(String workerId) {

        return lastStatusUpdatedAt.getOrDefault(workerId, 0L);
    }

    public void send(String workerId, String json) throws Exception {

        WebSocketSession session = workers.get(workerId);

        if (session == null) {
            return;
        }

        session.sendMessage(new TextMessage(json));
    }

    public void broadcast(String json) throws Exception {

        for (WebSocketSession session : workers.values()) {
            session.sendMessage(new TextMessage(json));
        }
    }

    private boolean isStatusMessage(String type) {
        return "STATUS".equalsIgnoreCase(type)
                || "response:status".equalsIgnoreCase(type)
                || type.endsWith(":status");
    }

    private String resolveInstanceId(JsonNode json) {
        String instanceId = json.path("instanceId").asText("");

        if (!instanceId.isBlank()) {
            return instanceId;
        }

        instanceId = json.path("from").asText("");
        if (!instanceId.isBlank()) {
            return instanceId;
        }

        instanceId = json.path("to").asText("");
        return instanceId.isBlank() ? null : instanceId;
    }

    private String extractStatusMessage(JsonNode json) {
        JsonNode payload = json.path("payload");

        if (payload.isMissingNode() || payload.isNull()) {
            String message = json.path("message").asText("");
            if (!message.isBlank()) {
                return message;
            }

            String statusMessage = json.path("statusMessage").asText("");
            if (!statusMessage.isBlank()) {
                return statusMessage;
            }

            return "";
        }

        if (payload.isTextual() || payload.isValueNode()) {
            return payload.asText("");
        }

        if (payload.isObject()) {
            for (String field : new String[] { "message", "statusMessage", "text", "status", "state" }) {
                JsonNode candidate = payload.path(field);
                if (!candidate.isMissingNode() && !candidate.isNull()) {
                    String text = candidate.asText("");
                    if (!text.isBlank()) {
                        return text;
                    }
                }
            }
        }

        return payload.toString();
    }
}