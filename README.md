# Conductor

Conductor is an application for managing multiple instances from different accounts. It enables centralized management, monitoring, and control of multiple instance processes running concurrently.

## Features

- 🚀 **Instance Management** - create, start, and stop instances
- 🔐 **Multi-Account Support** - handle profiles from different sources
- 📊 **Monitoring** - track instance status and logs
- ⚙️ **Configuration** - flexible configuration of instance directories

## Requirements

- Java 21+
- Maven 3.6+

## Building the Project

```bash
./mvnw clean package
```

## Running the Application

### With Default Instance Directory

The application will store instances in the `instances` directory in the current working directory:

```bash
java -jar conductor.jar
```

### With Custom Instance Directory

You can specify a custom directory for storing instances using the `--instances-dir` parameter:

```bash
java -jar conductor.jar --instances-dir=/path/to/custom/directory
```

For example:

```bash
java -jar conductor.jar --instances-dir=/data/conductor-instances
```

## Startup Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--instances-dir=<path>` | Path to the directory where instances will be stored | `instances` |

## Architecture

### Main Components

- **ProfileRepository** - manages instance profiles (loading, saving configuration)
- **ProcessService** - manages instance processes (start, stop, restart)
- **InstanceProfile** - represents instance configuration
- **InstanceRuntime** - represents a running instance

### Directory Structure

```
instances/
├── instance-1/
│   ├── config.json      # Instance configuration
│   ├── logs/            # Application logs
│   └── data/            # Instance data
├── instance-2/
│   ├── config.json
│   ├── logs/
│   └── data/
└── ...
```

## Configuration

The application is configured through command-line parameters. You can change the instance directory by passing the `--instances-dir` parameter when running the application.

## License

See the LICENSE file

## Author

Enoch
