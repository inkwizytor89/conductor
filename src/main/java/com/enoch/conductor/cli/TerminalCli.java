package com.enoch.conductor.cli;

import com.enoch.conductor.command.CommandMessage;
import com.enoch.conductor.instance.InstanceProfile;
import com.enoch.conductor.instance.ProfileRepository;
import com.enoch.conductor.process.ProcessService;
import com.enoch.conductor.ws.WorkerSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Scanner;
import java.util.UUID;

@Component
public class TerminalCli implements CommandLineRunner {

    private final ProfileRepository repository;
    private final ProcessService processService;
    private final WorkerSocketHandler socketHandler;

    private final ObjectMapper mapper = new ObjectMapper();

    public TerminalCli(
            ProfileRepository repository,
            ProcessService processService,
            WorkerSocketHandler socketHandler
    ) {
        this.repository = repository;
        this.processService = processService;
        this.socketHandler = socketHandler;
    }

    @Override
    public void run(String... args) {

        new Thread(this::terminalLoop).start();
    }

    private void terminalLoop() {

        Scanner scanner = new Scanner(System.in);

        while (true) {

            try {

                System.out.print("manager> ");

                String line = scanner.nextLine();

                String[] split = line.split(" ");

                switch (split[0]) {

                    case "create" -> create(split);
                    case "start" -> start(split);
                    case "stop" -> stop(split);
                    case "restart" -> restart(split);
                    case "list" -> list();
                    case "send" -> send(split);
                    case "broadcast" -> broadcast(split);
                    case "delete" -> delete(split);
                    case "help" -> help();
                }

            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
    private void create(String[] split) throws Exception {

        String login = split[1];
        String password = split[2];

        InstanceProfile profile = new InstanceProfile();

        profile.setId("worker-" + UUID.randomUUID().toString().substring(0, 6));
        profile.setUsername(login);
        profile.setPassword(password);
        profile.setPort(0);
        profile.setCreatedAt(System.currentTimeMillis());

        repository.save(profile);

        System.out.println("Created instance: " + profile.getId());
    }

    private void start(String[] split) throws Exception {

        String id = split[1];

        List<InstanceProfile> profiles = repository.loadAll();

        for (InstanceProfile profile : profiles) {

            if (profile.getId().equals(id)) {
                processService.start(profile);
                System.out.println("Started: " + id);
            }
        }
    }

    private void stop(String[] split) {

        processService.stop(split[1]);

        System.out.println("Stopped: " + split[1]);
    }

    private void restart(String[] split) throws Exception {

        String id = split[1];

        for (InstanceProfile profile : repository.loadAll()) {

            if (profile.getId().equals(id)) {
                processService.restart(profile);
            }
        }
    }

    private void list() throws Exception {

        for (InstanceProfile profile : repository.loadAll()) {

            System.out.println(
                    profile.getId() +
                            " | " +
                            profile.getUsername()
            );
        }
    }

    private void send(String[] split) throws Exception {

        String workerId = split[1];
        String command = split[2];

        CommandMessage msg = new CommandMessage();
        msg.setType(command);

        socketHandler.send(workerId, mapper.writeValueAsString(msg));
    }

    private void broadcast(String[] split) throws Exception {

        String command = split[1];

        CommandMessage msg = new CommandMessage();
        msg.setType(command);

        socketHandler.broadcast(mapper.writeValueAsString(msg));
    }

    private void delete(String[] split) {

        System.out.println("TODO delete profile + data");
    }

    private void help() {

        System.out.println("""
                create <login> <password>
                start <id>
                stop <id>
                restart <id>
                list
                send <id> <command>
                broadcast <command>
                delete <id>
                help
                """);
    }
}


