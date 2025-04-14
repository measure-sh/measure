# Self Hosting Guide <!-- omit in toc -->

measure.sh is designed from the ground up for easy self-hosting. Follow along to run measure.sh on your own infrastructure.

## Contents <!-- omit in toc -->

- [Objectives](#objectives)
- [Prerequisites](#prerequisites)
- [System Requirements](#system-requirements)
- [Deploy on a Linux virtual machine](#deploy-on-a-linux-virtual-machine)
  - [1. SSH into your VM](#1-ssh-into-your-vm)
  - [2. Clone the measure repo](#2-clone-the-measure-repo)
  - [3. Run the `install.sh` script](#3-run-the-installsh-script)
  - [4. Configure and start your self hosted measure instance](#4-configure-and-start-your-self-hosted-measure-instance)
  - [5. Setup a reverse proxy server](#5-setup-a-reverse-proxy-server)
  - [6. Setup DNS A records](#6-setup-dns-a-records)
  - [7. Access your measure.sh dashboard](#7-access-your-measuresh-dashboard)
- [Upgrade a Self Hosted Installation](#upgrade-a-self-hosted-installation)
- [Run on macOS locally](#run-on-macos-locally)
  - [System Requirements](#system-requirements-1)
  - [1. Clone the measure repo](#1-clone-the-measure-repo)
  - [2. Run `config.sh` script to configure](#2-run-configsh-script-to-configure)
  - [3. Start the containers](#3-start-the-containers)
  - [4. Access your Measure dashboard](#4-access-your-measure-dashboard)
- [Frequently Asked Questions](#frequently-asked-questions)
  - [Q. Why does ClickHouse consume high amount of CPU or memory?](#q-why-does-clickhouse-consume-high-amount-of-cpu-or-memory)

## Objectives

- Self host measure on a single VM instance
- Install and configure `caddy` as a reverse proxy
- Create and configure a Google OAuth application
- Create and configure a GitHub OAuth application

## Prerequisites

- Basic terminal/command line skills
- Basic text editor skills
- SSH access to a Cloud VM instance
- Ability to add DNS A records on your primary domain
- Ability to run commands with `sudo`
- `git` in your PATH
- External IP of the VM

## System Requirements

- x86-64/amd64 Linux Virutal Machine
- Any one of the following supported Linux distributions
  - Ubuntu 24.04 LTS
  - Debian 12 (Bookworm)
- At least 4 vCPUs
- At least 16 GB RAM
- At least 100 GB of boot disk volume
- Port `80` and `443` opened in firewall settings

## Deploy on a Linux virtual machine

Follow these step-by-step instructions to deploy measure.sh on a single Linux VM instance.

### 1. SSH into your VM

Deploy a Linux VM meeting the above system requirements on any popular Cloud hosting provider like Google Cloud Platform, AWS or DigitalOcean. Once the machine is up and running, SSH into it following your cloud provider's instructions.

### 2. Clone the measure repo

Let's start by moving to your home directory.

```sh
cd ~
```

Choose a git tag. You can find out the latest stable release tag from the [releases](https://github.com/measure-sh/measure/releases) page.

> [!IMPORTANT]
>
> Always choose a tag matching the format `v[MAJOR].[MINOR].[PATCH]`, for example: `v1.2.3`.
> These tags are tailored for self host deployments.

Clone the repository with git and change to the `measure` directory. Replace `GIT-TAG` with your chosen git tag.

```sh
git clone https://github.com/measure-sh/measure.git -b GIT-TAG && cd measure
```

### 3. Run the `install.sh` script

Next, change into the `self-host` directory. All successive commands will be run from this directory.

```sh
cd self-host
```

Run the install script with `sudo`.

```sh
sudo ./install.sh
```

> [!NOTE]
>
> To use **podman** instead of **docker**, use the *--podman* flag.
>
> ```sh
> sudo ./install.sh --podman
> ```
>
> This would install the following packages.
> - [podman](https://podman.io/)
> - [podman-docker](https://packages.debian.org/bookworm/podman-docker)
> - [podman-compose](https://github.com/containers/podman-compose)
>
> You can continue to use regular docker commands like, `docker ps -a` or `docker compose ps -a`. It should work seamlessly.

The measure.sh install script will check your system's requirements and start the installation. It can take a few minutes to complete.

### 4. Configure and start your self hosted measure instance

During installation, you'll be presented with the Measure configuration wizard.

For the first prompt, it'll ask for a namespace for your company or team. This typically will be your company or team's name. If trying out individually, feel free to set any name.

<p align="center">
  <img src="https://github.com/user-attachments/assets/70e5aa2c-8916-4b84-930a-e57a5c020e2a" alt="Measure Configuration Wizard" />
</p>

For the next prompt, you'll be asked to enter the URL to access measure.sh's web dashboard. Typically, this might look like a subdomain on your primary domain, for example, if your domain is `yourcompany.com`, enter `https://measure.yourcompany.com`.

Next, you'll be asked to enter the URL to access Measure's REST API endpoint. Typically, this might look like, `https://measure-api.yourcompany.com`.

<p align="center">
  <img src="https://github.com/user-attachments/assets/22610a50-202d-4e05-baf0-f2ab464d3ed7" alt="Measure Dashboard URL prompt" />
</p>

Later in this guide, you'll be setting DNS A records for the above subdomains you entered. For now, let's move on to the next prompt.

For the next few prompts, you'll need to obtain a Google & GitHub OAuth Application's credentials. This is required to setup authentication in measure.sh dashboard. Follow the below links to obtain Google & GitHub OAuth credentials.

- [Create a Google OAuth App](./google-oauth.md)
- [Create a GitHub OAuth App](./github-oauth.md)

Once you have created the above apps, copy the key and secrets and enter in the relevant prompts.

At this point, the install script will attempt to start all the Measure docker compose services. You should see a similar output.

<p align="center">
  <img src="https://github.com/user-attachments/assets/b33fbca4-4567-4077-9432-8be9f9c8b078" alt="Successful installation" />
</p>

At this point, all the services should be up, but they are not reachable from the internet. To make sure these services can serve traffic, let's setup:

- A reverse proxy using [caddy](https://caddyserver.com/)
- Setup DNS A recods on your domain

### 5. Setup a reverse proxy server

While we recommend [caddy](https://caddyserver.com) for routing incoming requests to the correct destinations. You can setup any other reverse proxy server of your choice, like [nginx](https://nginx.org/) or [traefik](https://traefik.io/). We chose Caddy because it's relatively straightforward to setup and comes with great defaults.

For now, let's setup caddy.

Change to your home directory.

```sh
cd ~
```

Run the following commands to install caddy.

```sh
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl && \
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg && \
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list && \
sudo apt update && \
sudo apt install caddy
```

If you are not installing on Ubuntu or Debian, please follow the guide on Caddy's [installation page](https://caddyserver.com/docs/install) and come back here when caddy is installed.

Create a basic `~/Caddyfile` config by running the following.

```sh
cat <<EOF > ~/Caddyfile
measure.yourcompany.com {
	reverse_proxy http://localhost:3000
}

measure-api.yourcompany.com {
	reverse_proxy http://localhost:8080
}
EOF
```

> [!NOTE]
>
> In the above Caddyfile, we have used the example domains from above, but make sure you replace with your actual domain names.

Next, reload caddy to make sure caddy picks up our newly generated config.

```sh
caddy reload
```

### 6. Setup DNS A records

For this last step, we'll setup 2 DNS A records and put those subdomains to work. First, obtain your VM's external IP address. Let's say, the external IP is `101.102.103.104`.

Go to your domain hosting provider and add A recrods for the following subdomains.

```
measure.yourcompany.com         IN A        101.102.103.104
measure-api.yourcompany.com     IN A        101.102.103.104
```

Depending on your domain provider, it might take a few mins to couple of hours for the above DNS records to take effect.

### 7. Access your measure.sh dashboard

Visit `https://measure.yourcompany.com` to access your dashboard and sign in to continue. Replace `yourcompany.com` with your domain.

## Upgrade a Self Hosted Installation

To upgrade to a specific or latest version of measure.sh, SSH to your VM instance first and run these commands.

For certain target versions, you will need to run extra migration scripts. Check out our [Migration Guides](../hosting/migration-guides/README.md).

```sh
# change to the directory you
# had cloned to.
cd ~/measure
```

Find out the suitable version from the [list of release tags](https://github.com/measure-sh/measure/releases). **We recommend sticking to the latest stable release.**

> [!IMPORTANT]
>
> Always choose a tag matching the format `v[MAJOR].[MINOR].[PATCH]`, for example: `v1.2.3`.
> These tags are tailored for self host deployments.

Run `git fetch` to fetch all tags.

```sh
git reset --hard # reset local modifications, if any
git fetch
```

Checkout to a particular git tag.

```sh
# replace `v1.2.3` with the suitable git tag
git checkout v1.2.3
```

Change to `self-host` directory and run `sudo ./install.sh` to perform the upgrade.

```sh
# change to `self-host` directory
cd self-host

# run the `install.sh` script
sudo ./install.sh
```

It'll take a few minutes for the upgrade to complete.

> [!NOTE]
>
> Please note that an upgrade may not happen smoothly because of incompatible changes or configuration mismatches. If you face any issues while upgrading or need advice, please do not hesitate to [open an issue](https://github.com/measure-sh/measure/issues/new/choose) or to drop a message on our [Discord](https://discord.gg/f6zGkBCt42).

## Run on macOS locally

You can run measure.sh locally on macOS for trying it out quickly, but keep in mind that not all features may not work as expected on macOS.

> [!WARNING]
>
> Not all features on macOS may work as expected. Don't use this setup for production. This guide was tested on macOS 14.6, though older or newer versions of macOS may work too.

### System Requirements

Make sure the following requirements are met before proceeding.

| Name           | Version  |
| -------------- | -------- |
| Docker         | v26.1+   |
| Docker Compose | v2.27.3+ |
| node           | v20+     |

### 1. Clone the measure repo

Clone the repository with git and change to the `measure` directory.

```sh
git clone https://github.com/measure-sh/measure.git && cd measure
```

Checkout to git a tag. Replace `GIT-TAG` with an existing git tag. You can find out the latest stable release tag from the [releases](https://github.com/measure-sh/measure/releases) page.

> [!IMPORTANT]
>
> Always choose a tag matching the format `v[MAJOR].[MINOR].[PATCH]`, for example: `v1.2.3`.
> These tags are tailored for self host deployments.

```sh
git checkout GIT-TAG
```

Next, change to the `self-host` directory. All commands will be run from the `self-host` directory after this point.

```sh
cd self-host
```

### 2. Run `config.sh` script to configure

Run the `config.sh` script to auto configure most settings.

```sh
./config.sh
```

To continue, you'll need to obtain a Google & GitHub OAuth Application's credentials. This is required to setup authentication in Measure dashboard. Follow the below links to obtain Google & GitHub OAuth credentials.

- [Create a Google OAuth App](./google-oauth.md)
- [Create a GitHub OAuth App](./github-oauth.md)

Once you have created the above apps, copy the key and secrets and enter in the relevant prompts.

### 3. Start the containers

To start the containers in production mode, run.

```sh
docker compose -f compose.yml -f compose.prod.yml \
  --profile init \
  --profile migrate \
  up --build
```

It'll take a few seconds for the containers to be healthy.

### 4. Access your Measure dashboard

Visit [Dashboard](http://localhost:3000/auth/login) to access your dashboard and sign in to continue.

## Frequently Asked Questions

Typical questions asked by other self host-ers.

### Q. Why does ClickHouse consume high amount of CPU or memory?

ClickHouse is engineered to maximize hardware utilization, often leading to high CPU and memory consumption. In an idle state, when Measure is not ingesting sessions or executing queries, you might observe 25-30% CPU consumption. Under higher load, CPU consumption may go up to 90-100%. This is completely normal and expected behavior.

Several factors contribute to this behavior.

1. **Query Execution and Parallelism**: ClickHouse executes queries using multiple threads to enhance performance. By default, it utilizes a number of threads equal to the number of available CPU cores.

2. **Background Merges and Mutations**: ClickHouse continously merges data parts in the background to optimize storage and query performance. These merge operations and data mutations can lead to increased resource consumption.

3. **Compression and Decompression**: ClickHouse employs compression algorithms to minimize storage space. Compressing and decompressing data during ingestion and queries are CPU-intensive operations.

4. **Hardware Considerations**: ClickHouse is configured to utilize available resources effectively and expects adequate RAM (32 GB or more is recommended). Our default configuration is designed to strike a balance between cost and performance for majority of users. Feel free to allocate additional system resources if your budget allows.

Having said that, we'll continue to optimize our configuration and recommendation over time to accommodate light & heavy weight usage patterns whenever possible.

> [!NOTE]
>
> If you want to discuss more, hop on to our [Discord](https://discord.gg/f6zGkBCt42) and ask your questions.

#### References <!-- omit in toc -->

1. [ClickHouse High CPU Usage](https://kb.altinity.com/altinity-kb-setup-and-maintenance/high-cpu-usage/)
2. [GitHub issue discussing mutations](https://github.com/ClickHouse/ClickHouse/issues/39403)
3. [ClickHouse Usage Recommendations](https://clickhouse.com/docs/en/operations/tips)
