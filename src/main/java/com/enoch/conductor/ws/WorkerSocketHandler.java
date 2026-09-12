package com.enoch.conductor.ws;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WorkerSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper mapper = new ObjectMapper();

    private final Map<String, WebSocketSession> workers = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {

        System.out.println("Worker connected");
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {

        JsonNode json = mapper.readTree(message.getPayload());

        String type = json.get("type").asText();

        if (type.equals("REGISTER")) {

            String instanceId = json.get("instanceId").asText();

            workers.put(instanceId, session);

            System.out.println("Registered worker: " + instanceId);
        }

        if (type.equals("LOG")) {
            System.out.println("[WORKER] " + json.get("message").asText());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {

        workers.values().remove(session);
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
}