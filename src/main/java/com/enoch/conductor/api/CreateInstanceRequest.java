package com.enoch.conductor.api;

public record CreateInstanceRequest(String id, boolean autoStart, String templateName) {
}
