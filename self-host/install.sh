#!/usr/bin/env bash

# ------------------------------------------------------------------------------
# Supported Operating Systems
# - Linux
# - macOS (partial)
#
# Supported Linux distributions
# - Ubuntu
# - Debian
# - RHEL (Red Hat Enterprise Linux)
# - Amazon Linux
# - Rocky Linux
# - OpenSUSE Leap
# - OpenSUSE Tumbleweed
# ------------------------------------------------------------------------------

# For increased robustness.
#
# -e          ensures the script stops on any command failure
# -u          prevents the use of undefined variables, helps
#             catch typos and other mistakes
# -o pipefail return exit status of last command in the
#             pipeline
set -euo pipefail

# ------------------------------------------------------------------------------
# System Requirements
# ------------------------------------------------------------------------------
MINIMUM_DOCKER_VERSION="26.1.3"
MINIMUM_DOCKER_COMPOSE_VERSION="2.27.3"

# ------------------------------------------------------------------------------
# Installation Settings
# ------------------------------------------------------------------------------
DEBUG=${DEBUG:-0}
UNINSTALL_DOCKER=${UNINSTALL_DOCKER:-0}

# ------------------------------------------------------------------------------
# Sister file paths.
# ------------------------------------------------------------------------------
ENV_FILE=.env

# logging and debugging
isTTY() {
  if [ -t 1 ]; then
    STDOUT_TTY=1
  else
    STDOUT_TTY=0
  fi

  return 0
}

debug() {
  if [[ $DEBUG -eq 1 ]]; then
    echo -e "DEBUG: $1"
  fi
}

info() {
  echo -e "INFO: $1"
}

warn() {
  echo -e "WARN: $1"
}

error() {
  echo -e "ERROR: $1"
  exit 1
}

# ------------------------------------------------------------------------------
# detect_os attempts to detect environment's operating system.
# ------------------------------------------------------------------------------
detect_os() {
  case "$(uname)" in
    Linux*)
    DETECTED_OS="Linux"
    ;;
    Darwin*)
    DETECTED_OS="macOS"
    ;;
    CYGWIN*|MSYS*|MINGW*)
    DETECTED_OS="Windows"
    ;;
    *)
    DETECTED_OS="unknown"
    ;;
  esac
}

# ------------------------------------------------------------------------------
# detect_arch attempts to detect environment's architecture.
# ------------------------------------------------------------------------------
detect_arch() {
  DETECTED_ARCH="$(uname -m)"
}

# ------------------------------------------------------------------------------
# detect_distro attempts to detect the linux distribution.
# ------------------------------------------------------------------------------
detect_distro() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    if ! [[ -z $NAME ]]; then
      DISTRO_NAME=$NAME
    fi
    if ! [[ -z $VERSION ]]; then
      DISTRO_VERSION=$VERSION
    fi
    if ! [[ -z $VERSION_CODENAME ]]; then
      DISTRO_CODENAME=$VERSION_CODENAME
    fi
  elif [ -f /etc/redhat-release ]; then
    DISTRO_NAME=$NAME
  elif command -v lsb_release >/dev/null 2>&1; then
    DISTRO_NAME=$(lsb_release -si)
    DISTRO_VERSION=$(lsb_release -sr)
  elif [ -f /etc/lsb-release ]; then
    . /etc/lsb-release
    DISTRO_NAME=$DISTRIB_ID
    DISTRO_VERSION=$DISTRIB_RELEASE
  elif [ -f /etc/debian_version ]; then
    DISTRO_NAME="Debian"
    DISTRO_VERSION=$(cat /etc/debian_version)
  else
    DISTRO_NAME="unknown"
    DISTRO_VERSION="unknown"
  fi
}

# ------------------------------------------------------------------------------
# detect_docker probes if docker's prerequisites are met.
# ------------------------------------------------------------------------------
detect_docker() {
  if ! has_command docker; then
    warn "Docker: not found"
    return 1
  else
    DETECTED_DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
    info "Docker: $DETECTED_DOCKER_VERSION"
  fi

  docker compose version
  if ! [ $? -eq 0 ]; then
    warn "Docker Compose: not found"
    return 1
  else
    DETECTED_DOCKER_COMPOSE_VERSION=$(docker compose version | cut -d' ' -f4 | cut -d'v' -f2)
    info "Docker Compose: $DETECTED_DOCKER_COMPOSE_VERSION"
  fi

  if [[ $DETECTED_DOCKER_VERSION < $MINIMUM_DOCKER_VERSION ]]; then
    warn "Docker minimum version not satisfied"
    return 1
  fi

  if [[ $DETECTED_DOCKER_COMPOSE_VERSION < $MINIMUM_DOCKER_COMPOSE_VERSION ]]; then
    warn "Docker Compose minimum version not satisfied"
    return 1
  fi
}

# ------------------------------------------------------------------------------
# install_docker attempts to install docker engine and compose
# considering the appropriate environment.
# ------------------------------------------------------------------------------
install_docker() {
  if is_macOS; then
    error "We don't support installing Docker on macOS. Install \"Docker Desktop for mac\" and run ./install.sh again."
  fi

  if is_ubuntu; then
    debug "Installing docker for ubuntu"
    # Add Docker's official GPG key
    $PKGMAN update
    $PKGMAN -y install ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    # Add the repository to Apt sources:
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    $PKGMAN update
    $PKGMAN -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi

  if is_debian; then
    debug "Installing docker for debian"
    debug "$DISTRO_CODENAME"

    # Add Docker's official GPG key
    $PKGMAN update
    $PKGMAN -y install ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    $PKGMAN update
    $PKGMAN -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi
}

# ------------------------------------------------------------------------------
# start_docker starts docker engine.
# ------------------------------------------------------------------------------
start_docker() {
  if is_ubuntu; then
    if [ -d /run/systemd/system ]; then
      systemctl start docker
    elif [ -f /etc/init.d/docker ]; then
      service docker start
    fi
  fi
}

# ------------------------------------------------------------------------------
# uninstall_docker uninstalls docker components.
# ------------------------------------------------------------------------------
uninstall_docker() {
  if is_macOS; then
    error "We don't support uninstalling Docker on macOS"
  fi

  info "Uninstalling docker"

  if is_ubuntu; then
    $PKGMAN purge -y \
      docker.io\
      docker-compose\
      docker-compose-v2\
      docker-doc\
      podman-docker\
      docker-ce-cli\
      containerd.io\
      docker-buildx-plugin\
      docker-compose-plugin\
      docker-ce-rootless-extras || true
  fi

  if is_debian; then
    $PKGMAN -y purge \
      docker.io\
      docker-compose\
      docker-compose-v2\
      docker-doc\
      podman-docker\
      docker-ce-cli\
      containerd.io\
      docker-buildx-plugin\
      docker-compose-plugin\
      docker-ce-rootless-extras
  fi
}

# ------------------------------------------------------------------------------
# start_docker_compose starts services using docker compose.
# ------------------------------------------------------------------------------
start_docker_compose() {
  local dockercmd="docker"

  if [[ $DEBUG -eq 1 ]]; then
    dockercmd="docker -D"
    debug "Docker is in debug mode"
  fi

  info "Starting Measure docker containers"

  $dockercmd compose \
    --progress plain \
    --profile init \
    --profile migrate \
    --file compose.yml \
    --file compose.prod.yml \
    up \
    --build \
    --detach
}

has_command() {
  if command -v "$1" &> /dev/null; then
    return 0
  else
    return 1
  fi
}

is_macOS() {
  [[ $DETECTED_OS == "macOS" ]]
}

is_linux() {
  [[ $DETECTED_OS == "Linux" ]]
}

is_windows() {
  [[ $DETECTED_OS == "Windows" ]]
}

is_ubuntu() {
  [[ $DISTRO_NAME == "Ubuntu" ]]
}

is_debian() {
  [[ $DISTRO_NAME == "Debian"* ]]
}

# ------------------------------------------------------------------------------
# set_package_manager chooses a suitable package manager.
# ------------------------------------------------------------------------------
set_package_manager() {
  if is_macOS; then
    PKGMAN="brew"
  fi 

  if is_linux; then
    if [[ $DISTRO_NAME == "Red Hat"* || $DISTRO_NAME == "Amazon Linux"* || $DISTRO_NAME == "Rocky Linux"* ]]; then
      PKGMAN="yum"
    elif [[ $DISTRO_NAME == "Ubuntu"* || $DISTRO_NAME == "Debian"* ]]; then
      PKGMAN="apt-get"
    elif [[ $DISTRO_NAME == "openSUSE"* ]]; then
      PKGMAN="zypper"
    fi
  fi

}

# ------------------------------------------------------------------------------
# init checks installation requirements and decides if installation should
# proceed.
# ------------------------------------------------------------------------------
init() {
  isTTY
  detect_os
  info "OS: $DETECTED_OS"
  detect_arch
  info "Architecture: $DETECTED_ARCH"

  if is_windows; then
    error "$DETECTED_OS is not supported yet"
  fi

  if [[ $DETECTED_OS == "unknown" ]]; then
    error "This operating system is not supported yet"
  fi

  if [[ $DETECTED_OS == "Linux" ]]; then
    detect_distro
    info "Linux distribution: $DISTRO_NAME $DISTRO_VERSION"
  fi

  # choose a package manager
  set_package_manager

  # fail if a package manager was not found
  if [ -z "${PKGMAN+x}" ]; then
    error "Couldn't determine a suitable package manager for your environment"
  fi

  # fail if a package manager was not found
  if ! has_command $PKGMAN; then
    error "Couldn't find \"$PKGMAN\" in the environment"
  fi

  info "Package manager: $PKGMAN"
}

# ------------------------------------------------------------------------------
# ensure_config ensures configuration is sound and usable.
# ------------------------------------------------------------------------------
ensure_config() {
  if ! [[ -e "$ENV_FILE" ]]; then
    set +u
    info "Configuration file missing, starting wizard"
    source ./config.sh
    set -u
  else
    info "Configuration file found, skipping wizard"
  fi
}

# ------------------------------------------------------------------------------
# ensure_docker ensures docker components are usable.
# ------------------------------------------------------------------------------
ensure_docker() {
  if ! detect_docker; then
    if [ $UNINSTALL_DOCKER -eq 1 ]; then
      uninstall_docker
    fi
    install_docker
  fi
}

# kickstart installation
init
ensure_docker
start_docker
ensure_config
start_docker_compose
