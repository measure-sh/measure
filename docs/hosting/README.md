# Self Hosting Guide <!-- omit in toc -->

Measure is designed from the ground up for easy self-hosting. Follow along to run Measure on your own infrastructure.

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
  - [7. Access your Measure dashboard](#7-access-your-measure-dashboard)

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

Follow these step-by-step instructions to deploy Measure on a single Linux VM instance.

### 1. SSH into your VM

Deploy a Linux VM meeting the above system requirements on any popular Cloud hosting provider like Google Cloud Platform, AWS or DigitalOcean. Once the machine is up and running, SSH into it following your cloud provider's instructions.

### 2. Clone the measure repo

Let's start by moving to your home directory.

```sh
cd ~
```

Clone the repository with git and change to the `measure` directory.

```sh
git clone git@github.com:measure-sh/measure.git
cd measure
```

Checkout to git a tag. Replace `GIT-TAG` with an existing git tag. You can find out the latest stable release tag from the [releases](https://github.com/measure-sh/measure/releases) page.

```sh
git checkout GIT-TAG
```

Next, change into the `self-host` directory. All commands will be run mostly from this directory.

```sh
cd self-host
```

### 3. Run the `install.sh` script

Run the install script with `sudo`.

```sh
sudo ./install.sh
```

The measure install script will check your system's requirements and start the installation. It can take a few minutes to complete.

### 4. Configure and start your self hosted measure instance

Once installation is complete, you'll be presented with the Measure configuration wizard.

_TODO: Insert image here_

Measure needs to know the environment you are configuring for. Choose `0` for production.

_TODO: Insert image here_

Next, it'll ask for a namespace for your company or team. This typically will be your company or team's name. If trying out individually, feel free to set any anonymous name.

_TODO: Insert image here_

For the next prompt, you'll be asked to enter the URL to access Measure's web dashboard. Typically, this might look like a subdomain on your primary domain, for example, if your domain is `yourcompany.com`, enter `https://measure.yourcompany.com`.

Next, you'll be asked to enter the URL to access Measure's REST API endpoint. Typically, this might look like, `https://measure-api.yourcompany.com`.

For the next prompt, enter a URL for serving static files. This can be `https://measure-assets.yourcompany.com` for example.

Later in this guide, you'll be setting DNS A records for the above subdomains you entered. For now, let's move on to the next prompt.

_TODO: Insert image here_

For the next few prompts, you'll need to obtain a Google & GitHub OAuth Application's credentials. This is required to setup authentication in Measure dashboard.

- [Create a Google OAuth App](./google-oauth.md)
- [Create a GitHub OAuth App](./github-oauth.md)

Once you have created the above apps, copy the key and secrets and enter in the relevant prompts.

At this point, the install script will attempt to start all the Measure docker compose services. You should see a similar output.

_TODO: Insert image here_

At this point, all the services should be up, but they are not reachable from the interwebs. To make sure these services can serve traffic, let's setup: 

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
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

If you are not installing on Ubuntu or Debian, please follow the guide on Caddy's [installation page](https://caddyserver.com/docs/install) and come back here when caddy is installed.

Create a basic `~/Caddyfile` config by running the following.

```sh
echo <<EOF > ~./Caddyfile
measure.yourcompany.com {
  reverse_proxy http://localhost:3000
}

measure-api.yourcompany.com {
  reverse_proxy http://localhost:8080
}

measure-assets.yourcompany.com {
  reverse_proxy http://localhost:9119
}
EOF
```

> [!Note]
> 
> In the above Caddyfile, we have used the example domains from above, but make sure you replace with your actual domain names.

Next, run `caddy reload` to make sure caddy picks up our newly generated config.

```sh
caddy reload
caddy start
```

### 6. Setup DNS A records

For this last step, we'll setup 3 DNS A records and put those subdomains to work. First, obtain your VM's external IP address. Let's say, the external IP is `101.102.103.104`.

Go to your domain hosting provider and add A recrods for the following subdomains.

```
measure.yourcompany.com         IN A        101.102.103.104
measure-api.yourcompany.com     IN A        101.102.103.104
measure-assets.yourcompany.com  IN A        101.102.103.104
```

Depending on your domain provider, it might take a few mins to couple of hours for the above DNS records to take effect.

### 7. Access your Measure dashboard

Visit `https://measure.yourcompany.com` to access your dashboard and sign in to continue.