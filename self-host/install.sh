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
USE_PODMAN=false
CONTAINER_RUNTIME=docker
DOCKER_COMPOSE_BIN=0

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

# parse command line flags
parse_args() {
  for arg in "$@"; do
    if [[ "$arg" == "--podman" ]]; then
      USE_PODMAN=true
      CONTAINER_RUNTIME=podman
    fi
  done
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
# has_command checks availability of commands.
# ------------------------------------------------------------------------------
has_command() {
  if command -v "$1" &>/dev/null; then
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
  CYGWIN* | MSYS* | MINGW*)
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

  # if `docker-compose` works, then use that for
  # successive invocation
  if has_command docker-compose; then
    DOCKER_COMPOSE="docker-compose"
    DOCKER_COMPOSE_BIN=1
  elif docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
    DOCKER_COMPOSE_BIN=0
  else
    warn "Neither 'docker compose' nor 'docker-compose' is available" >&2
    return 1
  fi

  $DOCKER_COMPOSE version
  if ! [ $? -eq 0 ]; then
    warn "Docker Compose: not found"
    return 1
  else
    DETECTED_DOCKER_COMPOSE_VERSION=$($DOCKER_COMPOSE version | cut -d' ' -f4 | cut -d'v' -f2)
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
    error "We don't support installing Docker on macOS. Install \"Docker Desktop for mac\" or \"podman\" and run ./install.sh again. \nhttps://docs.docker.com/desktop/setup/install/mac-install/\nhttps://podman.io/docs/installation"
  fi

  if is_ubuntu; then
    if [[ $USE_PODMAN == true ]]; then
      install_podman
      return 0
    fi

    debug "Installing docker for ubuntu"
    # Add Docker's official GPG key
    $PKGMAN update
    $PKGMAN -y install ca-certificates curl git
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    # Add the repository to Apt sources:
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list >/dev/null

    $PKGMAN update
    $PKGMAN -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi

  if is_debian; then
    if [[ $USE_PODMAN == true ]]; then
      install_podman
      return 0
    fi

    debug "Installing docker for debian"
    debug "$DISTRO_CODENAME"

    # Add Docker's official GPG key
    $PKGMAN update
    $PKGMAN -y install ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list >/dev/null

    $PKGMAN update
    $PKGMAN -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi
}

# ------------------------------------------------------------------------------
# install_podman attempts to install podman and compose
# considering the appropriate environment.
# ------------------------------------------------------------------------------
install_podman() {
  if ! is_debian && ! is_ubuntu; then
    error "We don't support installing podman on non Debian based distributions."
  fi

  if is_debian; then
    echo "deb http://deb.debian.org/debian/ trixie main" | tee /etc/apt/sources.list.d/trixie.list >/dev/null
    tee /etc/apt/preferences.d/99pinning >/dev/null <<EOF
# Prefer packages from the stable release (Bookworm)
Package: *
Pin: release n=bookworm
Pin-Priority: 990

# Allow packages from the testing release (Trixie), but give them lower priority
Package: *
Pin: release n=trixie
Pin-Priority: 100
EOF
    $PKGMAN update
    $PKGMAN install -y -t trixie podman podman-docker jq git
  fi

  if is_ubuntu; then
    debug "Installing podman for ubuntu"
    $PKGMAN update
    $PKGMAN -y install podman podman-docker jq git
  fi

  local arch_name=""
  arch_name=$(uname -m)
  local target_arch=""
  local os_name=""
  os_name=$(uname -s | tr '[:upper:]' '[:lower:]')
  local target_os=""

  # validate architecture
  case "$arch_name" in
  x86_64 | amd64)
    target_arch="x86_64"
    ;;
  aarch64 | arm64)
    target_arch="aarch64"
    ;;
  *)
    error "Unsupported architecture: $arch_name"
    ;;
  esac

  # validate operating system
  case "$os_name" in
  linux)
    target_os="linux"
    ;;
  darwin)
    target_os="darwin"
    ;;
  *)
    error "Unsupported operating system: $os_name"
    ;;
  esac

  local asset_name="docker-compose-${target_os}-${target_arch}"
  local compose_release_json=""
  local compose_download_url=""
  local compose_location="/usr/local/bin/docker-compose"
  compose_release_json=$(curl -sL https://api.github.com/repos/docker/compose/releases/latest)

  if [ -z "$compose_release_json" ]; then
    error "Failed to fetch latest release of docker compose. Check network connectivity."
  fi

  # parse json with jq
  compose_download_url=$(echo "$compose_release_json" | jq -r --arg asset_name "$asset_name" '.assets[] | select(.name == $asset_name) | .browser_download_url')

  if [ -z "$compose_download_url" ] || [ "$compose_download_url" == "null" ]; then
    error "Failed to download latest release of docker compose. Check network connectivity."
  fi

  local podman_compose_version="v1.3.0"
  local podman_compose_location="/usr/local/bin/podman-compose"

  info "Downloading latest release of docker compose from $compose_download_url"
  curl -sSL "$compose_download_url" -o "$compose_location"
  chmod +x "$compose_location"

  info "Downloading podman-compose@$podman_compose_version"
  curl -sSLo "$podman_compose_location" https://raw.githubusercontent.com/containers/podman-compose/refs/tags/"$podman_compose_version"/podman_compose.py
  chmod +x "$podman_compose_location"
}

# ------------------------------------------------------------------------------
# start_docker starts docker engine.
# ------------------------------------------------------------------------------
start_docker() {
  local service="docker"

  if [[ $USE_PODMAN == true ]]; then
    service="podman.socket"
    # suppress podman message
    if [[ ! -d /etc/containers ]]; then
      mkdir -p /etc/containers
    fi
    touch /etc/containers/nodocker
  fi

  if is_ubuntu || is_debian; then
    if [ -d /run/systemd/system ]; then
      systemctl start "$service"
    elif [ -f /etc/init.d/docker ]; then
      service "$service" start
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
      docker.io docker-compose docker-compose-v2 docker-doc podman-docker docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-ce-rootless-extras || true
  fi

  if is_debian; then
    $PKGMAN -y purge \
      docker.io docker-compose docker-compose-v2 docker-doc podman-docker docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-ce-rootless-extras
  fi
}

# ------------------------------------------------------------------------------
# detect_compose_command determines the correct docker compose command.
# ------------------------------------------------------------------------------
detect_compose_command() {
  DOCKER_CMD="docker"

  if [[ $DOCKER_COMPOSE_BIN -eq 1 ]]; then
    DOCKER_COMPOSE_CMD="docker-compose"
    return 0
  fi

  if [[ $DEBUG -eq 1 ]]; then
    DOCKER_CMD="$DOCKER_CMD -D"
    debug "Docker is in debug mode"
  fi

  DOCKER_COMPOSE_CMD="$DOCKER_CMD compose"
}

# ------------------------------------------------------------------------------
# update_symbolicator_origin updates value of symbolicator origin in .env file.
# ------------------------------------------------------------------------------
update_symbolicator_origin() {
  update_env_variable SYMBOLICATOR_ORIGIN "http://symbolicator:3021"
}

# ------------------------------------------------------------------------------
# add_symboloader_origin appends value of symboloader origin in .env file.
# ------------------------------------------------------------------------------
add_symboloader_origin() {
  add_env_variable SYMBOLOADER_ORIGIN "http://symboloader:8083"
}

# ------------------------------------------------------------------------------
# stop_docker_compose stops services using docker compose.
# ------------------------------------------------------------------------------
stop_docker_compose() {
  $DOCKER_COMPOSE_CMD \
    --progress plain \
    --profile init \
    --profile migrate \
    --file compose.yml \
    --file compose.prod.yml \
    down

  exit 0
}

# ------------------------------------------------------------------------------
# start_docker_compose starts services using docker compose.
# ------------------------------------------------------------------------------
start_docker_compose() {
  info "Starting measure.sh docker containers"

  $DOCKER_COMPOSE_CMD \
    --progress plain \
    --profile migrate \
    --file compose.yml \
    --file compose.prod.yml \
    up \
    --build \
    --pull always \
    --detach \
    --remove-orphans \
    --wait
}

# ------------------------------------------------------------------------------
# add_env_variable appends an .env file key with value.
# ------------------------------------------------------------------------------
add_env_variable() {
  local key="$1"
  local value="$2"
  local env_file="./.env"

  if [ ! -f "$env_file" ]; then
    warn ".env file not found, cannot update .env file automatically"
    return
  fi

  echo "${key}=${value}" >> "$env_file"
}

# ------------------------------------------------------------------------------
# update_env_variable updates and existing .env file key with value.
# ------------------------------------------------------------------------------
update_env_variable() {
  local key="$1"
  local new_value="$2"
  local env_file="./.env"

  if [ ! -f "$env_file" ]; then
    warn ".env file not found, cannot update .env file automatically"
    return
  fi

  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s|^${key}=.*|${key}=${new_value}|" "$env_file"
  else
    sed -i "s|^${key}=.*|${key}=${new_value}|" "$env_file"
  fi

  info "Updated ${key} in ${env_file} to ${new_value}"
}

# ------------------------------------------------------------------------------
# remove_symbolicator_android removes `symbolicator-android` image.
# ------------------------------------------------------------------------------
function remove_symbolicator_android() {
  # detect and remove `symbolicator-android` image.
  local image_ids
  image_ids=$(docker images --format '{{.Repository}} {{.ID}}' | awk '$1 ~ /symbolicator-android$/ {print $2}')

  if [ -z "$image_ids" ]; then
    return 0
  fi

  for id in $image_ids; do
    echo "Removing image ID: $id"
    docker rmi "$id"
  done
}

# ------------------------------------------------------------------------------
# remove_minio_mc_image detects and removes `minio/mc` image.
# ------------------------------------------------------------------------------
function remove_minio_mc_image() {
  # detect and remove `minio/mc` image.
  local image_ids
  image_ids=$(docker images --format '{{.Repository}} {{.ID}}' | awk '$1 ~ /minio\/mc$/ {print $2}')

  if [ -z "$image_ids" ]; then
    return 0
  fi

  for id in $image_ids; do
    echo "Removing image ID: $id"
    docker rmi "$id"
  done
}

# ------------------------------------------------------------------------------
# cleanup detects and removes unused resources.
# ------------------------------------------------------------------------------
cleanup() {
  remove_symbolicator_android
  remove_minio_mc_image
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
# ensure_config ensures configuration is sound and usable.
# ------------------------------------------------------------------------------
ensure_config() {
  if ! [[ -e "$ENV_FILE" ]]; then
    set +u
    info "Configuration file missing, starting wizard"
    source ./config.sh "--production" "--wizard"
    set -u
  else
    info "Configuration file found, skipping wizard"

    # set +u
    # info "Ensure configuration is up to date"
    # source ./config.sh "--production" "--ensure"
    # set -u
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

# ------------------------------------------------------------------------------
# init checks installation requirements and decides if installation should
# proceed.
# ------------------------------------------------------------------------------
init() {
  isTTY
  parse_args "$@"

  info "Container Runtime: $CONTAINER_RUNTIME"

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

  if ! has_command "openssl"; then
    error "openssl is not installed, please install openssl and try again."
  fi

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

# kickstart
init "$@"
ensure_docker
start_docker
ensure_config
detect_compose_command
# update_symbolicator_origin
# add_symboloader_origin
start_docker_compose
cleanup
