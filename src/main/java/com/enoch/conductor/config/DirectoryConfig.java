package com.enoch.conductor.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class DirectoryConfig implements CommandLineRunner {

    private final ConfigurableApplicationContext context;

    public DirectoryConfig(ConfigurableApplicationContext context) {
        this.context = context;
    }

    @Override
    public void run(String... args) throws Exception {
        String instancesDir = "instances";

        for (String arg : args) {
            if (arg.startsWith("--instances-dir=")) {
                instancesDir = arg.substring("--instances-dir=".length());
                break;
            }
        }

        ConfigurableEnvironment env = context.getEnvironment();
        Map<String, Object> props = new HashMap<>();
        props.put("conductor.instances-dir", instancesDir);
        env.getPropertySources().addFirst(new MapPropertySource("commandLineProps", props));
    }
}
