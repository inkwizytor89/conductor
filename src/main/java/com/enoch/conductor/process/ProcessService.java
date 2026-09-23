package com.enoch.conductor.process;

import com.enoch.conductor.instance.InstanceProfile;
import com.enoch.conductor.instance.InstanceRuntime;
import com.enoch.conductor.instance.ProfileRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
public class ProcessService {

    private final Map<String, InstanceRuntime> runtimes = new ConcurrentHashMap<>();
    private final String instancesDirPath;
    private final ProfileRepository profileRepository;

    public ProcessService(@Value("${conductor.instances-dir:instances}") String instancesDirPath,
                          ProfileRepository profileRepository) {
        this.instancesDirPath = instancesDirPath;
        this.profileRepository = profileRepository;
    }

    @PostConstruct
    public void autoStartInstances() throws Exception {
        List<InstanceProfile> profiles = profileRepository.loadAll();

        for (InstanceProfile profile : profiles) {
            if (profile.isAutoStart()) {
                try {
                    System.out.println("Auto-starting instance: " + profile.getId());
                    start(profile);
                } catch (Exception e) {
                    System.err.println("Failed to auto-start instance " + profile.getId());
                    e.printStackTrace();
                }
            }
        }
        System.out.println("Auto-starting instances completed. Currently running instances: " + runtimes.keySet());
    }

    /**
     * Starts an instance based on its profile.
     */
    public void start(InstanceProfile profile) throws Exception {
        if (runtimes.containsKey(profile.getId())) {
            System.out.println("Instance with id " + profile.getId() + " is already running");
            return;
        }

        Path instanceDir = Path.of(instancesDirPath, profile.getId());
        Files.createDirectories(instanceDir);
        String workerJarPath = new java.io.File("worker.jar").getAbsolutePath();

        ProcessBuilder pb = new ProcessBuilder(
                "java",
                "-jar",
                workerJarPath,
                "--instanceId=" + profile.getId(),
                "--instanceDir=" + instanceDir,
                "--managerUrl=ws://localhost:8080/ws"
        );

        pb.inheritIO();

        Process process = pb.start();

        InstanceRuntime runtime = new InstanceRuntime();
        runtime.setProcess(process);
        runtime.setPid(process.pid());
        runtime.setOnline(true);

        runtimes.put(profile.getId(), runtime);
        System.out.println("Started instance with id " + profile.getId() + " and pid " + process.pid());
    }

    /**
     * Stops a running instance.
     */
    public void stop(String id) {
        InstanceRuntime runtime = runtimes.get(id);

        if (runtime == null) {
            System.err.println("Instance with id " + id + " is not running");
            return;
        }

        System.err.println("Stopping instance with id " + id + " and pid " + runtime.getPid());
        runtime.getProcess().destroy();
        try {
            if (!runtime.getProcess().waitFor(5, TimeUnit.SECONDS)) {
                runtime.getProcess().destroyForcibly();
                runtime.getProcess().waitFor(5, TimeUnit.SECONDS);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted while stopping instance " + id, e);
        }
        runtime.setOnline(false);

        runtimes.remove(id);
    }

    /**
     * Restarts an instance.
     */
    public void restart(InstanceProfile profile) throws Exception {
        stop(profile.getId());
        Thread.sleep(1000);
        start(profile);
    }

    /**
     * Checks if an instance is running.
     */
    public boolean isRunning(String id) {
        InstanceRuntime runtime = runtimes.get(id);
        return runtime != null && runtime.getProcess().isAlive();
    }

    /**
     * Gets the runtime information for an instance.
     */
    public InstanceRuntime getRuntime(String id) {
        return runtimes.get(id);
    }

    /**
     * Gets all running runtimes.
     */
    public Map<String, InstanceRuntime> getAllRuntimes() {
        return new ConcurrentHashMap<>(runtimes);
    }
}