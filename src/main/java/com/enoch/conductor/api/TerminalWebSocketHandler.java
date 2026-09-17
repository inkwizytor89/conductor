package com.enoch.conductor.api;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

@Component
public class TerminalWebSocketHandler extends TextWebSocketHandler {

    private static class TerminalSession {
        WebSocketSession wsSession;
        Process process;
        BufferedReader reader;
        boolean running;
    }

    private final ConcurrentHashMap<String, TerminalSession> sessions = new ConcurrentHashMap<>();

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
        if (ts == null) return;

        String payload = message.getPayload();
        
        try {
            if (payload.startsWith("START:")) {
                String cmd = payload.substring(6);
                startCommand(ts, session, cmd);
            } else if (payload.equals("KILL")) {
                killCommand(ts, session);
            } else if (payload.startsWith("INPUT:")) {
                String input = payload.substring(6) + "\n";
                if (ts.process != null && ts.process.getOutputStream() != null) {
                    ts.process.getOutputStream().write(input.getBytes());
                    ts.process.getOutputStream().flush();
                }
            }
        } catch (Exception e) {
            session.sendMessage(new TextMessage("ERROR: " + e.getMessage()));
        }
    }

    private void startCommand(TerminalSession ts, WebSocketSession session, String cmd) throws Exception {
        if (ts.process != null && ts.process.isAlive()) {
            session.sendMessage(new TextMessage("ERROR: Process already running"));
            return;
        }

        ProcessBuilder pb = new ProcessBuilder("cmd", "/c", cmd);
        pb.redirectErrorStream(true);
        ts.process = pb.start();
        ts.running = true;

        new Thread(() -> readProcessOutput(ts, session)).start();
    }

    private void readProcessOutput(TerminalSession ts, WebSocketSession session) {
        try {
            BufferedReader reader = new BufferedReader(new InputStreamReader(ts.process.getInputStream()));
            String line;
            while (ts.running && (line = reader.readLine()) != null) {
                session.sendMessage(new TextMessage("OUTPUT: " + line));
            }
            
            int exitCode = ts.process.waitFor();
            session.sendMessage(new TextMessage("EXIT: " + exitCode));
            ts.running = false;
        } catch (Exception e) {
            try {
                session.sendMessage(new TextMessage("ERROR: " + e.getMessage()));
            } catch (Exception ignored) {}
        }
    }

    private void killCommand(TerminalSession ts, WebSocketSession session) throws Exception {
        if (ts.process != null) {
            ts.process.destroy();
            ts.running = false;
            session.sendMessage(new TextMessage("Process terminated"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, org.springframework.web.socket.CloseStatus status) throws Exception {
        TerminalSession ts = sessions.remove(session.getId());
        if (ts != null && ts.process != null) {
            ts.process.destroy();
        }
    }
}
