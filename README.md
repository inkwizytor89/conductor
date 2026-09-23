# Conductor

Conductor is an application for managing multiple instances from different accounts. It enables centralized management, monitoring, and control of multiple instance processes running concurrently.

## Features

- 🚀 **Instance Management** - create, start, stop, delete, and toggle auto-start for instances
- 🔐 **Multi-Account Support** - handle profiles from different sources
- 📊 **Monitoring** - track instance status and logs
- ⚙️ **Configuration** - flexible configuration of instance directories
- ⚡ **Auto-Start** - automatically start instances marked with auto-start on application startup

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

## Auto-Start Feature

Instances can be configured to automatically start when the application starts. To enable auto-start for an instance, set the `autoStart` field to `true` in the instance's `config.json` file:

```json
{
  "id": "my-instance",
  "autoStart": true
}
```

When the application starts, it will automatically launch all instances with `autoStart` set to `true`. This happens after all Spring beans are initialized.

## Architecture

### Main Components

- **ProcessService** - core service for managing instance lifecycle (start, stop, restart, auto-start)
- **ProfileRepository** - manages instance profiles (loading, saving configuration)
- **InstanceProfile** - represents instance configuration
- **InstanceRuntime** - represents a running instance
- **DirectoryConfig** - handles command-line directory parameter configuration

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

Instances are configured through their `config.json` files, where you can set properties like `autoStart`.

## License

See the LICENSE file

## Author

Enoch
