package com.enoch.conductor.api;

import com.enoch.conductor.instance.InstanceProfile;
import com.enoch.conductor.instance.ProfileRepository;
import com.enoch.conductor.process.ProcessService;
import com.enoch.conductor.startproperties.StartPropertiesRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class InstanceControllerTests {

    @TempDir
    Path tempDir;

    @Test
    void createInstanceWaitsForPlaceholdersBeforeMaterializing() throws Exception {
        Path instancesDir = tempDir.resolve("instances");
        Path templatesDir = tempDir.resolve("start-properties");
        Files.createDirectories(templatesDir);
        Files.writeString(templatesDir.resolve("demo.properties"), """
                main.login=<login>
                main.server=<server_name>
                """);

        ProfileRepository profileRepository = new ProfileRepository(instancesDir.toString());
        StartPropertiesRepository startPropertiesRepository = new StartPropertiesRepository(templatesDir.toString());
        ProcessService processService = mock(ProcessService.class);
        InstanceController controller = new InstanceController(processService, profileRepository, startPropertiesRepository);

        ResponseEntity<CreateInstanceResponse> response = controller.createInstance(
                new CreateInstanceRequest("alpha", "beta", "demo.properties", "demo-db")
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        CreateInstanceResponse body = response.getBody();
        assertNotNull(body);
        assertEquals("alpha#beta", body.id());
        assertTrue(body.placeholders().contains("login"));
        assertTrue(body.placeholders().contains("server_name"));
        assertFalse(Files.exists(instancesDir.resolve("alpha#beta")));

        ResponseEntity<Map<String, String>> applyResponse = controller.applyPlaceholders(
                "alpha#beta",
                new ApplyPlaceholdersRequest(
                        "alpha",
                        "beta",
                        "demo.properties",
                        "demo-db",
                        Map.of(
                                "login", "beta",
                                "server_name", "alpha"
                        )
                )
        );

        assertEquals(HttpStatus.OK, applyResponse.getStatusCode());
        InstanceProfile savedProfile = profileRepository.findById("alpha#beta").orElseThrow();
        assertTrue(savedProfile.isAutoStart());
        assertEquals("demo-db", savedProfile.getDatabaseName());
        assertTrue(Files.exists(instancesDir.resolve("alpha#beta").resolve("config.json")));
        assertTrue(Files.readString(instancesDir.resolve("alpha#beta").resolve("server.properties")).contains("main.login=beta"));
    }
}
