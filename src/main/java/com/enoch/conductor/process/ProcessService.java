package com.enoch.conductor.process;


import com.enoch.conductor.instance.InstanceProfile;
import com.enoch.conductor.instance.InstanceRuntime;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ProcessService {

    private final Map<String, InstanceRuntime> runtimes = new ConcurrentHashMap<>();
    
    private final String instancesDirPath;

    public ProcessService(@Value("${conductor.instances-dir:instances}") String instancesDirPath) {
        this.instancesDirPath = instancesDirPath;
    }

    public void start(InstanceProfile profile) throws Exception {

        if (runtimes.containsKey(profile.getId())) {
            return;
        }

        Path instanceDir = Path.of(instancesDirPath, profile.getId());

        ProcessBuilder pb = new ProcessBuilder(
                "java",
                "-jar",
                "worker.jar",
                "--instanceId=" + profile.getId(),
                "--instanceDir=" + instanceDir,
                "--managerUrl=ws://localhost:8080/ws"
        );

        pb.directory(instanceDir.toFile());
        pb.inheritIO();

        Process process = pb.start();

        InstanceRuntime runtime = new InstanceRuntime();
        runtime.setProcess(process);
        runtime.setPid(process.pid());

        runtimes.put(profile.getId(), runtime);
    }

    public void stop(String id) {

        InstanceRuntime runtime = runtimes.get(id);

        if (runtime == null) {
            System.err.println("Instance with id " + id + " is not running");
            return;
        }
        System.err.println("Stopping instance with id " + id + " and pid " + runtime.getPid());
        runtime.getProcess().destroy();

        runtimes.remove(id);
    }

    public void restart(InstanceProfile profile) throws Exception {

        stop(profile.getId());

        Thread.sleep(1000);

        start(profile);
    }

    public boolean isRunning(String id) {

        InstanceRuntime runtime = runtimes.get(id);

        return runtime != null && runtime.getProcess().isAlive();
    }
}