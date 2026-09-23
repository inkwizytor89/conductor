package com.enoch.conductor.api;

import com.enoch.conductor.instance.InstanceProfile;
import com.enoch.conductor.instance.ProfileRepository;
import com.enoch.conductor.process.ProcessService;
import com.enoch.conductor.startproperties.StartPropertiesRepository;
import com.enoch.conductor.startproperties.StartPropertyTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/instances")
@CrossOrigin(origins = "*")
public class InstanceController {

    private final ProcessService processService;
    private final ProfileRepository profileRepository;
    private final StartPropertiesRepository startPropertiesRepository;

    public InstanceController(ProcessService processService,
                              ProfileRepository profileRepository,
                              StartPropertiesRepository startPropertiesRepository) {
        this.processService = processService;
        this.profileRepository = profileRepository;
        this.startPropertiesRepository = startPropertiesRepository;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listInstances() throws Exception {
        List<InstanceProfile> profiles = profileRepository.loadAll();
        
        List<Map<String, Object>> response = profiles.stream()
                .map(profile -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", profile.getId());
                    item.put("autoStart", profile.isAutoStart());
                    item.put("running", processService.isRunning(profile.getId()));
                    var runtime = processService.getRuntime(profile.getId());
                    item.put("pid", runtime != null ? runtime.getPid() : null);
                    return item;
                })
                .toList();

        return ResponseEntity.ok(response);
    }

    @GetMapping("/templates")
    public ResponseEntity<List<StartPropertyTemplate>> listTemplates() throws Exception {
        return ResponseEntity.ok(startPropertiesRepository.listTemplates());
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<Map<String, String>> startInstance(@PathVariable String id) throws Exception {
        InstanceProfile profile = profileRepository.loadAll().stream()
                .filter(p -> p.getId().equals(id))
                .findFirst()
                .orElse(null);
        
        if (profile == null) {
            return ResponseEntity.notFound().build();
        }
        
        processService.start(profile);
        return ResponseEntity.ok(Map.of("message", "Instance started", "id", id));
    }

    @PostMapping("/{id}/stop")
    public ResponseEntity<Map<String, String>> stopInstance(@PathVariable String id) {
        processService.stop(id);
        return ResponseEntity.ok(Map.of("message", "Instance stopped", "id", id));
    }

    @PostMapping("/{id}/restart")
    public ResponseEntity<Map<String, String>> restartInstance(@PathVariable String id) throws Exception {
        InstanceProfile profile = profileRepository.loadAll().stream()
                .filter(p -> p.getId().equals(id))
                .findFirst()
                .orElse(null);
        
        if (profile == null) {
            return ResponseEntity.notFound().build();
        }
        
        processService.restart(profile);
        return ResponseEntity.ok(Map.of("message", "Instance restarted", "id", id));
    }

    @GetMapping("/{id}/status")
    public ResponseEntity<Map<String, Object>> getInstanceStatus(@PathVariable String id) throws Exception {
        InstanceProfile profile = profileRepository.loadAll().stream()
                .filter(p -> p.getId().equals(id))
                .findFirst()
                .orElse(null);
        
        if (profile == null) {
            return ResponseEntity.notFound().build();
        }
        
        Map<String, Object> status = new HashMap<>();
        status.put("id", profile.getId());
        status.put("running", processService.isRunning(id));
        status.put("autoStart", profile.isAutoStart());
        var runtime = processService.getRuntime(id);
        status.put("pid", runtime != null ? runtime.getPid() : -1);
        
        return ResponseEntity.ok(status);
    }

    @PostMapping
    public ResponseEntity<CreateInstanceResponse> createInstance(@RequestBody CreateInstanceRequest request) throws Exception {
        String instanceId = request.id();
        String templateName = request.templateName();

        if (instanceId == null || instanceId.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        if (templateName == null || templateName.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        StartPropertyTemplate template;
        try {
            template = startPropertiesRepository.getTemplate(templateName);
        } catch (IOException e) {
            return ResponseEntity.badRequest().build();
        }

        if (template == null) {
            return ResponseEntity.badRequest().build();
        }

        if (profileRepository.findById(instanceId).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }

        InstanceProfile profile = new InstanceProfile();
        profile.setId(instanceId);
        profile.setAutoStart(request.autoStart());

        try {
            profileRepository.save(profile);
            List<String> placeholders = startPropertiesRepository.copyTemplateToInstance(
                    templateName,
                    profileRepository.resolveInstanceDir(instanceId)
            );
            return ResponseEntity.ok(new CreateInstanceResponse("Instance created", instanceId, placeholders));
        } catch (Exception e) {
            try {
                profileRepository.delete(instanceId);
            } catch (IOException cleanupError) {
                e.addSuppressed(cleanupError);
            }
            throw e;
        }
    }

    @PostMapping("/{id}/placeholders")
    public ResponseEntity<Map<String, String>> applyPlaceholders(@PathVariable String id,
                                                                 @RequestBody Map<String, String> values) throws Exception {
        InstanceProfile profile = profileRepository.findById(id).orElse(null);

        if (profile == null) {
            return ResponseEntity.notFound().build();
        }

        try {
            startPropertiesRepository.applyPlaceholderValues(
                    profileRepository.resolveInstanceDir(id).resolve("server.properties"),
                    values
            );
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "message", e.getMessage(),
                    "id", id
            ));
        }

        return ResponseEntity.ok(Map.of(
                "message", "Placeholders updated",
                "id", id
        ));
    }

    @PostMapping("/{id}/autostart/toggle")
    public ResponseEntity<Map<String, Object>> toggleAutoStart(@PathVariable String id) throws Exception {
        InstanceProfile profile = profileRepository.findById(id).orElse(null);

        if (profile == null) {
            return ResponseEntity.notFound().build();
        }

        profile.setAutoStart(!profile.isAutoStart());
        profileRepository.save(profile);

        return ResponseEntity.ok(Map.of(
                "message", "Auto-start updated",
                "id", id,
                "autoStart", profile.isAutoStart()
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteInstance(@PathVariable String id) throws Exception {
        InstanceProfile profile = profileRepository.findById(id).orElse(null);

        if (profile == null) {
            return ResponseEntity.notFound().build();
        }

        if (processService.isRunning(id)) {
            processService.stop(id);
        }

        try {
            profileRepository.delete(id);
        } catch (IOException e) {
            throw e;
        }

        return ResponseEntity.ok(Map.of(
                "message", "Instance deleted",
                "id", id
        ));
    }
}
