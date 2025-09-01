# comomn shared functions
#
# NOTE:
# This file should only conain shell functions. It should
# not contain any statements.

# ------------------------------------------------------------------------------
# get_env_variable gets the .env variable value for key
# ------------------------------------------------------------------------------
get_env_variable() {
  local env_file=".env"
  local var_name="$1"
  local var_value

  if [[ ! -f "$env_file" ]]; then
    echo "Error: $env_file file not found"
    return 1
  fi

  var_value=$(
    # shellcheck source=../.env
    source "$env_file" 2>/dev/null || exit 1

    if [[ -n "${!var_name}" ]]; then
      printf "%s" "${!var_name}"
    else
      exit 2
    fi
  )

  local subshell_exit_code=$?

  if [[ "$subshell_exit_code" -eq 2 ]]; then
    echo "Error: Variable '${var_name}' not found in '${env_file}'." >&2
    return 2
  elif [[ "$subshell_exit_code" -ne 0 ]]; then
    echo "Error: Failed to process '${var_name}' or extract variable '${var_name}'." >&2
    return 3
  fi

  printf "%s" "$var_value"
  return 0
}

check_env_variable() {
  local var_name="$1"
  local env_file=".env"

  # Fail fast if no .env file exists
  [[ ! -f "$env_file" ]] && return 1

  # Match only non-comment lines that start with VAR=
  if grep -qE "^[[:space:]]*${var_name}=" "$env_file"; then
    return 0
  else
    return 1
  fi
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
