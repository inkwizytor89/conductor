package com.enoch.conductor.api;

import com.enoch.conductor.instance.InstanceProfile;
import com.enoch.conductor.instance.ProfileRepository;
import com.enoch.conductor.process.ProcessService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/instances")
@CrossOrigin(origins = "*")
public class InstanceController {

    private final ProcessService processService;
    private final ProfileRepository profileRepository;

    public InstanceController(ProcessService processService, ProfileRepository profileRepository) {
        this.processService = processService;
        this.profileRepository = profileRepository;
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
    public ResponseEntity<Map<String, String>> createInstance(@RequestBody Map<String, Object> request) throws Exception {
        String instanceId = (String) request.get("id");
        
        if (instanceId == null || instanceId.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        InstanceProfile profile = new InstanceProfile();
        profile.setId(instanceId);
        profile.setAutoStart((Boolean) request.getOrDefault("autoStart", false));
        
        profileRepository.save(profile);
        return ResponseEntity.ok(Map.of("message", "Instance created", "id", instanceId));
    }
}
