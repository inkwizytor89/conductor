package com.enoch.conductor.api;

import com.enoch.conductor.cli.TerminalCli;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.concurrent.ConcurrentHashMap;

@Component
public class TerminalWebSocketHandler extends TextWebSocketHandler {

    private final TerminalCli terminalCli;

    private static class TerminalSession {
        WebSocketSession wsSession;
        boolean running;
    }

    private final ConcurrentHashMap<String, TerminalSession> sessions = new ConcurrentHashMap<>();

    public TerminalWebSocketHandler(TerminalCli terminalCli) {
        this.terminalCli = terminalCli;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        TerminalSession ts = new TerminalSession();
        ts.wsSession = session;
        ts.running = false;
        sessions.put(session.getId(), ts);

        session.sendMessage(new TextMessage("Terminal connected"));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        TerminalSession ts = sessions.get(session.getId());
        if (ts == null) {
            return;
        }

        String payload = message.getPayload();

        try {
            if (payload.startsWith("START:")) {
                String command = payload.substring(6);
                String output = terminalCli.executeCommand(command);
                if (output != null && !output.isBlank()) {
                    for (String line : output.split("\\R")) {
                        session.sendMessage(new TextMessage("OUTPUT: " + line));
                    }
                }
                session.sendMessage(new TextMessage("EXIT: 0"));
            } else if (payload.equals("KILL")) {
                session.sendMessage(new TextMessage("OUTPUT: Terminal commands are handled by TerminalCli"));
                session.sendMessage(new TextMessage("EXIT: 0"));
            } else if (payload.startsWith("INPUT:")) {
                session.sendMessage(new TextMessage("OUTPUT: INPUT is handled by TerminalCli commands"));
                session.sendMessage(new TextMessage("EXIT: 0"));
            }
        } catch (Exception e) {
            session.sendMessage(new TextMessage("ERROR: " + e.getMessage()));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, org.springframework.web.socket.CloseStatus status) throws Exception {
        sessions.remove(session.getId());
    }
}
