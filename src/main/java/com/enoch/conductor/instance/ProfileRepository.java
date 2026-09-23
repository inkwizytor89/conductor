package com.enoch.conductor.instance;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class ProfileRepository {

    private final ObjectMapper mapper = new ObjectMapper();

    private final Path instancesDir;

    public ProfileRepository(@Value("${conductor.instances-dir:instances}") String instancesDirPath) {
        this.instancesDir = Path.of(instancesDirPath);
    }

    public List<InstanceProfile> loadAll() throws Exception {

        List<InstanceProfile> profiles = new ArrayList<>();

        if (!Files.exists(instancesDir)) {
            Files.createDirectories(instancesDir);
        }

        try (var paths = Files.list(instancesDir)) {
            paths.filter(Files::isDirectory)
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
        }

        return profiles;
    }

    public Optional<InstanceProfile> findById(String id) throws Exception {
        return loadAll().stream()
                .filter(profile -> profile.getId().equals(id))
                .findFirst();
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

    public void delete(String id) throws IOException {
        Path dir = instancesDir.resolve(id);

        if (!Files.exists(dir)) {
            return;
        }

        try (var paths = Files.walk(dir)) {
            paths.sorted(Comparator.reverseOrder())
                    .forEach(path -> {
                        try {
                            Files.deleteIfExists(path);
                        } catch (IOException e) {
                            throw new RuntimeException(e);
                        }
                    });
        } catch (RuntimeException e) {
            if (e.getCause() instanceof IOException ioException) {
                throw ioException;
            }
            throw e;
        }
    }

    public Path resolveInstanceDir(String id) {
        return instancesDir.resolve(id);
    }
}