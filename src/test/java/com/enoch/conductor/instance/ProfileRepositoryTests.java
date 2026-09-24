package com.enoch.conductor.instance;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProfileRepositoryTests {

    @TempDir
    Path tempDir;

    @Test
    void loadAllSetsNewestPropertiesWhenConfigMissing() throws Exception {
        Path instancesDir = tempDir.resolve("instances");
        Path instanceDir = instancesDir.resolve("alpha");
        Files.createDirectories(instanceDir);

        Files.writeString(
                instanceDir.resolve("config.json"),
                "{\"id\":\"alpha\",\"autoStart\":true,\"databaseName\":\"demo\"}"
        );

        Path olderProperties = instanceDir.resolve("older.properties");
        Files.writeString(olderProperties, "older=true");
        Files.setLastModifiedTime(olderProperties, FileTime.fromMillis(1_000));

        Path nestedDir = instanceDir.resolve("nested");
        Files.createDirectories(nestedDir);
        Path newerProperties = nestedDir.resolve("newer.properties");
        Files.writeString(newerProperties, "newer=true");
        Files.setLastModifiedTime(newerProperties, FileTime.fromMillis(2_000));

        ProfileRepository repository = new ProfileRepository(instancesDir.toString());
        List<InstanceProfile> profiles = repository.loadAll();

        assertEquals(1, profiles.size());
        String expectedRelativePath = instanceDir.relativize(newerProperties).toString();
        assertEquals(expectedRelativePath, profiles.get(0).getProperties());
        assertTrue(Files.readString(instanceDir.resolve("config.json")).contains("\"properties\""));
    }

    @Test
    void loadAllRemovesMissingPropertiesWhenNoPropertiesFilesExist() throws Exception {
        Path instancesDir = tempDir.resolve("instances");
        Path instanceDir = instancesDir.resolve("beta");
        Files.createDirectories(instanceDir);

        Files.writeString(
                instanceDir.resolve("config.json"),
                "{\"id\":\"beta\",\"autoStart\":false,\"databaseName\":null,\"properties\":\"missing.properties\"}"
        );

        ProfileRepository repository = new ProfileRepository(instancesDir.toString());
        List<InstanceProfile> profiles = repository.loadAll();

        assertEquals(1, profiles.size());
        assertNull(profiles.get(0).getProperties());
        assertFalse(Files.readString(instanceDir.resolve("config.json")).contains("\"properties\""));
    }
}
