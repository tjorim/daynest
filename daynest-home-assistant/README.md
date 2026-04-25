# Daynest

[![GitHub Release][releases-shield]][releases]
[![GitHub Activity][commits-shield]][commits]
[![License][license-shield]](LICENSE)

[![hacs][hacsbadge]][hacs]
![Project Maintenance][maintenance-shield]

<!--
Uncomment and customize these badges if you want to use them:

[![BuyMeCoffee][buymecoffeebadge]][buymecoffee]
[![Discord][discord-shield]][discord]
-->

**✨ Develop in the cloud:** Want to contribute or customize this integration? Open it directly in GitHub Codespaces - no local setup required!

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/daynest/daynest-home-assistant?quickstart=1)

## ✨ Features

- **Easy Setup**: Simple configuration through the UI - no YAML required
- **Air Quality Monitoring**: Track AQI and PM2.5 levels in real-time
- **Filter Management**: Monitor filter life and get replacement alerts
- **Smart Control**: Adjust fan speed, target humidity, and operating modes
- **Child Lock**: Safety feature to prevent accidental changes
- **Diagnostic Info**: View filter life, runtime hours, and device statistics
- **Reconfigurable**: Change the configured URL and API key anytime without removing the integration
- **Options Flow**: Adjust settings like update interval after setup
- **Custom Services**: Advanced control with built-in service calls

**This integration will set up the following platforms.**

| Platform        | Description                                              |
| --------------- | -------------------------------------------------------- |
| `sensor`        | Air quality index (AQI), PM2.5, filter life, and runtime |
| `binary_sensor` | API connection status and filter replacement alert       |
| `switch`        | Child lock and LED display controls                      |
| `select`        | Fan speed selection (Low/Medium/High/Auto)               |
| `number`        | Target humidity setting (30-80%)                         |
| `button`        | Reset filter timer after replacement                     |
| `fan`           | Air purifier fan control with speed settings             |

> [!TIP]
> **Interactive Demo:** The entities are interconnected for demonstration.
> Press the **Reset Filter Timer** button to see **Filter Life Remaining** update to 100%.
> Changing the **Air Purifier** fan speed syncs the **Fan Speed** select, and vice versa.

## 🚀 Quick Start

### Step 1: Install the Integration

**Prerequisites:** This integration requires [HACS](https://hacs.xyz/) (Home Assistant Community Store) to be installed.

Click the button below to open the integration directly in HACS:

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=daynest&repository=daynest-home-assistant&category=integration)

Then:

1. Click "Download" to install the integration
2. **Restart Home Assistant** (required after installation)

> [!NOTE]
> The My Home Assistant redirect will first take you to a landing page. Click the button there to open your Home Assistant instance.

<details>
<summary><strong>Manual Installation (Advanced)</strong></summary>

If you prefer not to use HACS:

1. Download the `custom_components/daynest/` folder from this repository
2. Copy it to your Home Assistant's `custom_components/` directory
3. Restart Home Assistant

</details>

### Step 2: Add and Configure the Integration

**Important:** You must have installed the integration first (see Step 1) and restarted Home Assistant!

#### Option 1: One-Click Setup (Quick)

Click the button below to open the configuration dialog:

[![Open your Home Assistant instance and start setting up a new integration.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=daynest)

Follow the setup wizard:

1. Enter your Daynest base URL (`CONF_URL`)
2. Paste your integration API key (`CONF_API_KEY`)
3. Click **Submit**

That's it. The integration will use that URL and API key to start loading your data.

#### Option 2: Manual Configuration

1. Go to **Settings** → **Devices & Services**
2. Click **"+ Add Integration"**
3. Search for "Daynest"
4. Follow the same setup steps as Option 1

### Step 3: Adjust Settings (Optional)

After setup, you can adjust options:

1. Go to **Settings** → **Devices & Services**
2. Find **Daynest**
3. Click **Configure** to adjust:
   - Update interval (how often to refresh data)
   - Enable debug logging

You can also **Reconfigure** the stored URL and API key anytime without removing the integration.

### Step 4: Start Using!

The integration creates several entities for your air purifier:

- **Sensors**: Air quality index, PM2.5 levels, filter life remaining, total runtime
- **Binary Sensors**: API connection status, filter replacement alert
- **Switches**: Child lock, LED display control
- **Select**: Fan speed (Low/Medium/High/Auto)
- **Number**: Target humidity (30-80%)
- **Button**: Reset filter timer
- **Fan**: Air purifier fan control

Find all entities in **Settings** → **Devices & Services** → **Daynest** → click on the device.

## Integration Docs

- [Getting Started](docs/user/GETTING_STARTED.md) - Installation and initial setup
- [Configuration](docs/user/CONFIGURATION.md) - Detailed configuration options
- [Examples](docs/user/EXAMPLES.md) - Automation and dashboard examples
- [Backend Integration: Home Assistant Custom Integration](docs/user/BACKEND_INTEGRATION_HOME_ASSISTANT.md) - API scope, base URL, endpoints, and error handling guidance

## HACS Repository Structure

This repository is structured for direct HACS installation:

- `hacs.json` exists in the repository root and defines HACS metadata
- Integration code is located at `custom_components/daynest/`
- `custom_components/daynest/manifest.json` includes the integration `version`
- `README.md` is rendered in HACS for install/setup guidance

## Compatibility Matrix (Integration ↔ Backend Contract)

The integration includes the backend contract expectation using the `X-Integration-Contract` header. Keep backend behavior aligned with the matrix below during upgrades.

| Integration version | Expected `X-Integration-Contract` | Backend expectation |
| --- | --- | --- |
| `0.1.x` | `home-assistant; version=ha.v1` | Supports `GET /api/v1/integrations/home-assistant/summary` and `GET /api/v1/integrations/home-assistant/dashboard` contract documented in [the backend integration guide](docs/user/BACKEND_INTEGRATION_HOME_ASSISTANT.md). |

> [!NOTE]
> When introducing a new backend contract (`2`, etc.), add a new row before release and document compatibility or migration notes in `CHANGELOG.md`.

## Release Checklist

Use this checklist before and after publishing each integration release.

### 1) Version tagging

- [ ] Confirm `custom_components/daynest/manifest.json` version is correct (`./script/version`)
- [ ] Confirm release tag format is `vX.Y.Z` and matches `manifest.json`
- [ ] Verify `.release-please-manifest.json` is aligned (`./script/version --check`)

### 2) Changelog updates

- [ ] Verify `CHANGELOG.md` includes all user-facing changes for the release
- [ ] Ensure compatibility or migration notes are present for contract changes
- [ ] Ensure non-user-facing internal changes remain excluded (per release-please config)

### 3) Daynest backend contract compatibility notes

- [ ] Confirm the compatibility matrix in this README is updated for the new version
- [ ] Confirm backend expectation still matches integration requests and payload parsing
- [ ] If contract changed, include explicit upgrade notes and rollback guidance

### 4) Post-release validation in a real Home Assistant instance

- [ ] Install from HACS in a non-dev Home Assistant instance and restart HA
- [ ] Add or reconfigure the Daynest integration through UI config flow
- [ ] Validate entities load and update (`sensor`, `binary_sensor`, `fan`, `select`, `number`, `button`, `switch`)
- [ ] Execute `daynest.reload_data` and verify coordinator refresh succeeds
- [ ] Check Home Assistant logs for auth, schema, and availability errors
- [ ] Validate diagnostics redaction and confirm no secrets are exposed
- [ ] Verify upgrade path from previous release (no orphaned entities or broken config entries)

## Available Entities

### Sensors

- **Air Quality Index (AQI)**: Real-time air quality measurement (0-500 scale)
  - Includes air quality category (Good/Moderate/Unhealthy/etc.)
  - Health recommendations based on current AQI
- **PM2.5**: Fine particulate matter concentration in µg/m³
- **Filter Life Remaining** (Diagnostic): Shows remaining filter life as percentage
- **Total Runtime** (Diagnostic): Total operating hours of the device

### Binary Sensors

- **API Connection**: Shows whether the connection to the API is active
  - On: Connected and receiving data
  - Off: Connection lost or authentication failed
  - Shows update interval and API endpoint information
- **Filter Replacement Needed**: Alerts when filter needs replacement
  - Shows estimated days remaining
  - Turns on when filter life is low

### Switches

- **Child Lock**: Prevents accidental button presses on the device
  - Icon changes based on state (locked/unlocked)
- **LED Display**: Enable/disable the LED display
  - Disabled by default - enable in entity settings if needed

### Select

- **Fan Speed**: Choose from Low, Medium, High, or Auto
  - Icon changes dynamically based on selected speed
  - Auto mode adjusts speed based on air quality
  - Syncs bidirectionally with the Air Purifier fan entity

### Number

- **Target Humidity**: Set desired humidity level (30-80%)
  - Adjustable in 5% increments
  - Displayed as a slider in the UI

### Button

- **Reset Filter Timer**: Reset the filter life to 100%
  - Press to reset after replacing the filter
  - Instantly updates the Filter Life Remaining sensor

### Fan

- **Air Purifier**: Control the air purifier fan speed and power
  - Three speed levels: Low, Medium, High
  - Syncs bidirectionally with the Fan Speed select entity
  - Turn on/off functionality

## Custom Services

The integration provides services for advanced automation:

### `daynest.example_action`

Perform a custom action (customize this for your needs).

**Example:**

```yaml
service: daynest.example_action
data:
  # Add your parameters here
```

### `daynest.reload_data`

Manually refresh data from the API without waiting for the update interval.

**Example:**

```yaml
service: daynest.reload_data
```

Use these services in automations or scripts for more control.

## Configuration Options

### During Setup

| Name     | Required | Description           |
| -------- | -------- | --------------------- |
| URL (`CONF_URL`) | Yes | Base URL of the Daynest backend |
| API Key (`CONF_API_KEY`) | Yes | Integration API key with `ha:read` scope |

### After Setup (Options)

You can change these anytime by clicking **Configure**:

| Name             | Default | Description                |
| ---------------- | ------- | -------------------------- |
| Update Interval  | 1 hour  | How often to refresh data  |
| Enable Debugging | Off     | Enable extra debug logging |

## Troubleshooting

### Authentication Issues

#### Reauthentication

If the configured URL or API key becomes invalid, Home Assistant will prompt you to reconfigure the integration:

1. Go to **Settings** → **Devices & Services**
2. Look for **"Action Required"** or **"Configuration Required"** message on the integration
3. Click **"Reconfigure"** or follow the prompt
4. Enter the updated `CONF_URL` and `CONF_API_KEY`
5. Click **Submit**

The integration will automatically resume normal operation with the new URL and API key.

#### Manual Credential Update

You can also update `CONF_URL` and `CONF_API_KEY` at any time without waiting for an error:

1. Go to **Settings** → **Devices & Services**
2. Find **Daynest**
3. Click the **3 dots menu** → **Reconfigure**
4. Enter the new URL and API key
5. Click **Submit**

#### Connection Status

Monitor your connection status with the **API Connection** binary sensor:

- **On** (Connected): Integration is receiving data normally
- **Off** (Disconnected): Connection lost or authentication failed
  - Check the binary sensor attributes for diagnostic information
  - Verify `CONF_URL` and `CONF_API_KEY` if authentication failed
  - Check network connectivity

### Enable Debug Logging

To enable debug logging for this integration, add the following to your `configuration.yaml`:

```yaml
logger:
  default: info
  logs:
    custom_components.daynest: debug
```

### Common Issues

#### Authentication Errors

If you receive authentication errors:

1. Verify `CONF_URL` points at the Daynest backend origin
2. Verify `CONF_API_KEY` is correct and has the necessary permissions
3. Wait for the automatic reconfiguration prompt, or manually reconfigure
4. Check the API Connection binary sensor for status

#### Device Not Responding

If your device is not responding:

1. Check the **API Connection** binary sensor - it should be "On"
2. Check your network connection
3. Verify the device is powered on
4. Check the integration diagnostics (Settings → Devices & Services → Daynest → 3 dots → Download diagnostics)

## 🤝 Contributing

Contributions are welcome! Please open an issue or pull request if you have suggestions or improvements.

You have two options to set up a development environment — expand below for full details.

<details>
<summary><strong>Development Setup</strong></summary>

Both options provide the same fully-configured environment with Home Assistant, Python 3.14, Node.js LTS, and all necessary tools.

### Option 1: GitHub Codespaces (Recommended) ☁️

Develop directly in your browser without installing anything locally!

1. Click the green **"Code"** button in this repository
2. Switch to the **"Codespaces"** tab
3. Click **"Create codespace on main"**
4. **Wait for setup** (2-3 minutes first time) — everything installs automatically
5. **Review and commit** your changes in the Source Control panel (`Ctrl+Shift+G`)

> [!TIP]
> Codespaces gives you **60 hours/month free** for personal accounts. When you start Home Assistant (`script/develop`), port 8123 forwards automatically.

### Option 2: Local Development with VS Code 💻

#### Prerequisites

You'll need these installed locally:

- **A Docker-compatible container engine** — see options by platform:

  | Option                                                                                                                   | 🍎 macOS | 🐧 Linux | 🪟 Windows | Notes                                                                                                                                                                                                                                     |
  | ------------------------------------------------------------------------------------------------------------------------ | :------: | :------: | :--------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | [Docker Desktop](https://www.docker.com/products/docker-desktop/)                                                        |    ✅    |    ✅    |     ✅     | **Easiest starting point for all platforms.** GUI-based, well-documented, one installer. Uses WSL2 as default backend on Windows (Hyper-V also available). Installation requires admin rights; daily use does not. Free for personal use. |
  | [OrbStack](https://orbstack.dev/) ⭐                                                                                     |    ✅    |    —     |     —      | **Recommended for macOS** once Docker Desktop feels slow. Starts in ~2s, much lighter on RAM/CPU, full Docker API compatibility. Free for personal use.                                                                                   |
  | [Docker CE](https://docs.docker.com/engine/install/) (native) ⭐                                                         |    —     |    ✅    |     —      | **Recommended for Linux.** Install directly via your package manager — no VM, no GUI, no overhead. Free.                                                                                                                                  |
  | [WSL2](https://learn.microsoft.com/windows/wsl/install) + [Docker CE](https://docs.docker.com/engine/install/ubuntu/) ⭐ |    —     |    —     |     ✅     | **Recommended for Windows** once you're comfortable with WSL2. Docker runs natively inside WSL2 — no GUI overhead. Requires one-time WSL2 setup. Free.                                                                                    |
  | [Rancher Desktop](https://rancherdesktop.io/)                                                                            |    ✅    |    ✅    |     ✅     | Open source by SUSE. GUI-based, uses WSL2 on Windows. Good alternative to Docker Desktop. Free.                                                                                                                                           |
  | [Colima](https://github.com/abiosoft/colima)                                                                             |    ✅    |    ✅    |     —      | CLI-only, very lightweight. Good for terminal-focused workflows. Free.                                                                                                                                                                    |

- **VS Code** with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- **Git** — macOS and Linux usually have it already; see below if not, or to get a newer version:
  - **🍎 macOS:** The system Git (`xcode-select --install`) works fine. Recommended: `brew install git` ([Homebrew](https://brew.sh/)) for a current version.
  - **🐧 Linux:** Usually pre-installed. If not: `sudo apt install git` (or your distro's equivalent).
  - **🪟 Windows + WSL2 ⭐:** Install Git _inside WSL2_ with `sudo apt install git`. Git on Windows itself is not needed — VS Code clones and operates entirely within WSL2.
  - **🪟 Windows + Docker Desktop:** Install via `winget install Git.Git` or download [Git for Windows](https://git-scm.com/download/win).
- **Hardware** — the devcontainer runs a full Home Assistant instance including Python tooling:

  |          | Minimum    | Recommended                           |
  | -------- | ---------- | ------------------------------------- |
  | **RAM**  | 8 GB       | 16 GB or more                         |
  | **CPU**  | 4 cores    | 8 cores or more                       |
  | **Disk** | 10 GB free | 20 GB free (SSD strongly recommended) |

> [!TIP]
> **Not sure which Docker option to pick?** Start with [Docker Desktop](https://www.docker.com/products/docker-desktop/) — it works on all platforms, has a GUI, and needs no extra setup. The ⭐ options are faster alternatives once you're comfortable. macOS and Linux offer the best devcontainer experience — containers run with no extra VM layer and file I/O is fast. Windows works well too; this integration uses named container volumes (files live inside WSL2, not on the Windows drive) to keep performance acceptable.

> [!NOTE]
> **New to Dev Containers?** See the [VS Code Dev Containers documentation](https://code.visualstudio.com/docs/devcontainers/containers#_system-requirements) for system requirements and how to install the extension. **Once the extension is installed, you're done** — this repository already ships a complete devcontainer configuration. You don't need to follow the rest of the VS Code guide; the setup steps below are all that's needed.

#### Setup Steps

1. **Clone in a Dev Container:**

   **🍎 macOS / 🐧 Linux:** Clone the repository and open the folder in VS Code → click **"Reopen in Container"** when prompted (or `F1` → **"Dev Containers: Reopen in Container"**).

   **🪟 Windows:** In VS Code, press `F1` → **"Dev Containers: Clone Repository in Named Container Volume..."** and enter the repository URL. This keeps files inside WSL2 for best I/O performance.

2. Wait for the container to build (2-3 minutes first time)

3. **Review and commit** changes in Source Control (`Ctrl+Shift+G`)

4. **Start developing**:

   ```bash
   script/develop  # Home Assistant runs at http://localhost:8123
   ```

> [!NOTE]
> Both Codespaces and local DevContainer provide the exact same experience. The only difference is where the container runs (GitHub's cloud vs. your machine).

</details>

---

## 🤖 AI-Assisted Development

> [!NOTE]
> **Transparency Notice:** This integration was developed with assistance from AI coding agents (GitHub Copilot, Claude, and others). While the codebase follows Home Assistant Core standards, AI-generated code may not be reviewed or tested to the same extent as manually written code. AI tools were used to generate boilerplate code, implement standard integration features (config flow, coordinator, entities), ensure code quality and type safety, and write documentation. If you encounter unexpected behavior, please [open an issue](../../issues) on GitHub.
>
> _This section can be removed or modified if AI assistance was not used in your integration's development._

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ by [@daynest][user_profile]**

---

[commits-shield]: https://img.shields.io/github/commit-activity/y/daynest/daynest-home-assistant.svg?style=for-the-badge
[commits]: https://github.com/daynest/daynest-home-assistant/commits/main
[hacs]: https://github.com/hacs/integration
[hacsbadge]: https://img.shields.io/badge/HACS-Default-orange.svg?style=for-the-badge
[license-shield]: https://img.shields.io/github/license/daynest/daynest-home-assistant.svg?style=for-the-badge
[maintenance-shield]: https://img.shields.io/badge/maintainer-%40daynest-blue.svg?style=for-the-badge
[releases-shield]: https://img.shields.io/github/release/daynest/daynest-home-assistant.svg?style=for-the-badge
[releases]: https://github.com/daynest/daynest-home-assistant/releases
[user_profile]: https://github.com/jpawlowski

<!-- Optional badge definitions - uncomment if needed:
[buymecoffee]: https://www.buymeacoffee.com/jpawlowski
[buymecoffeebadge]: https://img.shields.io/badge/buy%20me%20a%20coffee-donate-yellow.svg?style=for-the-badge
[discord]: https://discord.gg/Qa5fW2R
[discord-shield]: https://img.shields.io/discord/330944238910963714.svg?style=for-the-badge
-->
