package com.enoch.conductor.instance;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

@Service
public class ProfileRepository {

    private final ObjectMapper mapper = new ObjectMapper();

    private final Path instancesDir = Path.of("instances");

    public List<InstanceProfile> loadAll() throws Exception {

        List<InstanceProfile> profiles = new ArrayList<>();

        if (!Files.exists(instancesDir)) {
            Files.createDirectories(instancesDir);
        }

        Files.list(instancesDir)
                .filter(Files::isDirectory)
                .forEach(path -> {
                    try {

                        File file = path.resolve("config.json").toFile();

                        if (file.exists()) {
                            profiles.add(
                                    mapper.readValue(file, InstanceProfile.class)
                            );
                        }

                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                });

        return profiles;
    }

    public void save(InstanceProfile profile) throws Exception {

        Path dir = instancesDir.resolve(profile.getId());

        Files.createDirectories(dir);
        Files.createDirectories(dir.resolve("logs"));
        Files.createDirectories(dir.resolve("data"));

        mapper.writerWithDefaultPrettyPrinter()
                .writeValue(
                        dir.resolve("config.json").toFile(),
                        profile
                );
    }
}