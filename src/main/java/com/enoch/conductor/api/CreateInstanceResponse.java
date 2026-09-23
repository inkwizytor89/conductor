package com.enoch.conductor.api;

import java.util.List;

public record CreateInstanceResponse(String message, String id, List<String> placeholders) {
}
