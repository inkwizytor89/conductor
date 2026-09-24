package com.enoch.conductor.templateproperties;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TemplatePropertiesRepositoryTests {

    @TempDir
    Path tempDir;

    @Test
    void seedsTemplatesDirectoryFromClasspathResources() throws Exception {
        Path templatesDir = tempDir.resolve("templates");
        TemplatePropertiesRepository repository = new TemplatePropertiesRepository(templatesDir.toString());

        repository.ensureDefaultTemplatesExist();

        assertTrue(Files.isDirectory(templatesDir));
        Set<String> actualFiles;
        try (var paths = Files.list(templatesDir)) {
            actualFiles = paths.map(path -> path.getFileName().toString()).collect(Collectors.toSet());
        }

        Set<String> expectedFiles = Set.of(
                "build.properties",
                "clean.properties",
                "clear.properties",
                "duty.properties",
                "expedition.properties",
                "global.properties",
                "sleep.properties"
        );

        assertEquals(expectedFiles, actualFiles);

        for (String fileName : expectedFiles) {
            assertEquals(
                    readResource("template-properties/" + fileName),
                    Files.readString(templatesDir.resolve(fileName), StandardCharsets.UTF_8)
            );
        }
    }

    private String readResource(String resourcePath) throws Exception {
        try (InputStream inputStream = getClass().getClassLoader().getResourceAsStream(resourcePath)) {
            if (inputStream == null) {
                throw new IllegalStateException("Missing test resource: " + resourcePath);
            }
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
