#!/usr/bin/env bash


# ------------------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------------------
# Path to environment file
ENV_FILE=.env

# Prompt for database passwords
PROMPT_DB_PASSWORDS=${PROMPT_DB_PASSWORDS:-0}

# Trigger prompt for configuring storage
# bucket settings.
USE_EXTERNAL_BUCKETS=${USE_EXTERNAL_BUCKETS:-0}

# Generates cryptographically strong
# password of desired length
generate_password() {
  local length="$1"
  echo $(openssl rand -base64 "$length" | tr -dc 'A-Za-z0-9')
}

# Validates namespace value
validate_name() {
  # must not be empty
  if [[ -z "$1" ]]; then
    return 1
  fi

  # must only contain lowercase alphabets
  # and hyphens
  if [[ ! "$1" =~ ^[a-z-]+$ ]]; then
    return 1
  fi


  # must not contain spaces
  if [[ "$1" =~ \  ]]; then
    return 1
  fi

  # must not contain consecutive hyphens
  if [[ "$1" =~ -- ]]; then
    return 1
  fi

  return 0
}

validate_empty() {
  if [[ -z "$1" ]]; then
    return 1
  fi

  return 0
}

# Prompts for automatic or manual password
# generation.
prompt_password() {
  local length="$1"
  local passprompt="$2"

  if ! validate_empty "$2"; then
    passprompt="Enter a strong password: "
  fi

  read -p "Enter 'a'(recommended) to automatically generate a value or 'm' \
to manually enter: " choice

  while true; do
    case "$choice" in
      a)
        password=$(generate_password "$length" "$passprompt")
        break
        ;;
      m)
        read -p "$passprompt" password
        if [[ -z "$password" ]]; then
          continue
        fi
        break
        ;;
      *)
        echo "Invalid choice. Please try again."
        ;;
    esac
  done

  echo $password
}

# Prompts for manual value entry
prompt_value_manual() {
  local value
  local valprompt="$1"

  if ! validate_empty "$1"; then
    valprompt="Enter the value: "
  fi

  while [[ -z "$value" ]]; do
    read -p "$valprompt" value
  done

  echo $value
}

# Prompts for manual password entry
prompt_password_manual() {
  local password
  local passprompt="$1"

  if ! validate_empty "$1"; then
    passprompt="Enter a strong password: "
  fi

  while [[ -z "$password" ]]; do
    read -p "$passprompt" password
  done

  echo $password
}

# Creates final namespace by suffixing
# 5 random characters to namespace input
create_ns() {
  local input="$1"

  # Generate a random 5-character hexadecimal string
  local suffix=$(printf '%05x' $((RANDOM % 0xFFFFFF)))
  local result="${input}-${suffix}"

  echo "$result"
}

# Writes environment file for development
write_dev_env() {
  cat <<'EOF' > "$ENV_FILE"
#                                                            ( )    
#   ___ ___     __     _ _   ___  _   _  _ __   __       ___ | |__  
# /' _ ` _ `\ /'__`\ /'_` )/',__)( ) ( )( '__)/'__`\   /',__)|  _ `\
# | ( ) ( ) |(  ___/( (_| |\__, \| (_) || |  (  ___/ _ \__, \| | | |
# (_) (_) (_)`\____)`\__,_)(____/`\___/'(_)  `\____)(_)(____/(_) (_)

# Unified Measure Configuration
#
# Contains environment variables that are shared
# across various Measure components.

#############
# Databases #
#############

POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_MIGRATION_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/postgres?search_path=dbmate,public&sslmode=disable
POSTGRES_DSN=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/postgres

CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DSN=clickhouse://${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}@clickhouse:9000/default

##################
# Object Storage #
##################

AWS_ENDPOINT_URL=http://minio:9000

# Symbolication features won't work without these
SYMBOLS_S3_BUCKET=msr-symbols-sandbox
SYMBOLS_S3_BUCKET_REGION=us-east-1
SYMBOLS_ACCESS_KEY=minio
SYMBOLS_SECRET_ACCESS_KEY=minio123

# Session attachments won't work without these
ATTACHMENTS_S3_ORIGIN=http://localhost:9119
ATTACHMENTS_S3_BUCKET=msr-attachments-sandbox
ATTACHMENTS_S3_BUCKET_REGION=us-east-1
ATTACHMENTS_ACCESS_KEY=minio
ATTACHMENTS_SECRET_ACCESS_KEY=minio123

####################
# Measure Services #
####################

SYMBOLICATOR_ORIGIN=http://symbolicator-retrace:8181

NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
API_BASE_URL=http://api:8080

######################
# Dependent Services #
######################

MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=minio123

EOF

  cat <<EOF >> "$ENV_FILE"
########
# Auth #
########

OAUTH_GOOGLE_KEY=$OAUTH_GOOGLE_KEY
OAUTH_GITHUB_KEY=$OAUTH_GITHUB_KEY
OAUTH_GITHUB_SECRET=$OAUTH_GITHUB_SECRET
SESSION_ACCESS_SECRET=super-secret-for-jwt-token-with-at-least-32-characters
SESSION_REFRESH_SECRET=super-secret-for-jwt-token-with-at-least-32-characters

EOF
}

# Writes environment file for production
write_prod_env() {
  cat <<EOF > "$ENV_FILE"
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_MIGRATION_URL=postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/postgres?search_path=dbmate,public&sslmode=disable
POSTGRES_DSN=postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/postgres

CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD
CLICKHOUSE_DSN=clickhouse://\${CLICKHOUSE_USER}:\${CLICKHOUSE_PASSWORD}@clickhouse:9000/default

MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD

AWS_ENDPOINT_URL=http://minio:9000

SYMBOLS_S3_BUCKET=$SYMBOLS_S3_BUCKET
SYMBOLS_S3_BUCKET_REGION=$SYMBOLS_S3_BUCKET_REGION
SYMBOLS_ACCESS_KEY=$SYMBOLS_ACCESS_KEY
SYMBOLS_SECRET_ACCESS_KEY=$SYMBOLS_SECRET_ACCESS_KEY

ATTACHMENTS_S3_ORIGIN=$ATTACHMENTS_S3_ORIGIN
ATTACHMENTS_S3_BUCKET=$ATTACHMENTS_S3_BUCKET
ATTACHMENTS_S3_BUCKET_REGION=$ATTACHMENTS_S3_BUCKET_REGION
ATTACHMENTS_ACCESS_KEY=$ATTACHMENTS_ACCESS_KEY
ATTACHMENTS_SECRET_ACCESS_KEY=$ATTACHMENTS_SECRET_ACCESS_KEY

SYMBOLICATOR_ORIGIN=http://symbolicator-retrace:8181
NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
API_BASE_URL=http://api:8080

OAUTH_GOOGLE_KEY=$OAUTH_GOOGLE_KEY
OAUTH_GITHUB_KEY=$OAUTH_GITHUB_KEY
OAUTH_GITHUB_SECRET=$OAUTH_GITHUB_SECRET
SESSION_ACCESS_SECRET=$SESSION_ACCESS_SECRET
SESSION_REFRESH_SECRET=$SESSION_REFRESH_SECRET

EOF
}

# ------------------------------------------------------------------------------
# Interactive wizard
# ------------------------------------------------------------------------------
cat <<END
----------------------------
Measure Configuration Wizard
----------------------------

This interactive wizard helps you to setup Measure
settings according to your chosen environment.

END

cat <<END
Choose environment
  0 - production
  1 - development

END

echo -n "Choose [0/1]: "
read -r ANS_ENV

if [[ $ANS_ENV == "0" ]]; then
  SETUP_ENV=production
else
  SETUP_ENV=development
fi

echo -e "\nEnvironment is set to [$SETUP_ENV]"

cat <<END

Enter a name for your company or team.

Example: acme-corp

Measure will use this as a namespace to identify
this installation instance.
END

while true; do
  echo -e "\nOnly lowercase alphabets and hyphens, no spaces"
  read -p "Enter a name: " ANS_NAME

  if validate_name "$ANS_NAME"; then
    NAMESPACE=$(create_ns "$ANS_NAME")
    echo -e "\nNamespace is set to [$NAMESPACE]"
    break
  else
    echo -e "\nInvalid input. Please try again."
  fi
done

if [[ "$SETUP_ENV" == "development" ]]; then
  OAUTH_GOOGLE_KEY=$(prompt_value_manual "Enter Google oauth app key: ")
  OAUTH_GITHUB_KEY=$(prompt_value_manual "Enter GitHub oauth app key: ")
  OAUTH_GITHUB_SECRET=$(prompt_password_manual "Enter GitHub oauth app secret: ")
  write_dev_env
elif [[ "$SETUP_ENV" == "production" ]]; then
  POSTGRES_USER="postgres"
  MINIO_ROOT_USER="minio"
  MINIO_ROOT_PASSWORD=$(generate_password 24)

  if [[ $PROMPT_DB_PASSWORDS -eq 1 ]]; then
    # Prompt for database passwords
    echo -e "\nSet Postgres user's password"
    POSTGRES_PASSWORD=$(prompt_password 24 "Enter password for Postgres user: ")

    echo -e "\nSet ClickHouse user's password"
    CLICKHOUSE_PASSWORD=$(prompt_password 24 "Enter password for ClickHouse user: ")
  else
    # Generate secure database passwords
    echo -e "\nGenerating a secure Postgres user password"
    POSTGRES_PASSWORD=$(generate_password 24)

    echo -e "\nGenerating a secure ClickHouse user password"
    CLICKHOUSE_PASSWORD=$(generate_password 24)
  fi

  if [[ $USE_EXTERNAL_BUCKETS -eq 1 ]]; then
    echo -e "\nSet storage bucket for symbols"
    SYMBOLS_S3_BUCKET=$(prompt_value_manual "Enter symbols S3 bucket name: ")
    SYMBOLS_S3_BUCKET_REGION=$(prompt_value_manual "Enter symbols S3 bucket region: ")
    SYMBOLS_ACCESS_KEY=$(prompt_value_manual "Enter symbols S3 bucket access key: ")
    SYMBOLS_SECRET_ACCESS_KEY=$(prompt_password_manual "Enter symbols S3 bucket secret access key: ")

    echo -e "\nSet storage bucket for attachments"
    ATTACHMENTS_S3_ORIGIN=$(prompt_value_manual "Enter attachments S3 bucket origin: ")
    ATTACHMENTS_S3_BUCKET=$(prompt_value_manual "Enter attachments S3 bucket name: ")
    ATTACHMENTS_S3_BUCKET_REGION=$(prompt_value_manual "Enter attachments S3 bucket region: ")
    ATTACHMENTS_ACCESS_KEY=$(prompt_value_manual "Enter attachments S3 bucket access key: ")
    ATTACHMENTS_SECRET_ACCESS_KEY=$(prompt_value_manual "Enter attachments S3 bucket secret access key: ")
  else
    echo -e "\nSet storage bucket for symbols"
    SYMBOLS_S3_BUCKET="msr-$NAMESPACE-symbols"
    SYMBOLS_S3_BUCKET_REGION="us-east-1"
    SYMBOLS_ACCESS_KEY=$MINIO_ROOT_USER
    SYMBOLS_SECRET_ACCESS_KEY=$MINIO_ROOT_PASSWORD

    echo -e "\nSet storage bucket for attachments"
    echo -e "Example: https://measure-attachments.yourcompany.com"
    ATTACHMENTS_S3_ORIGIN=$(prompt_value_manual "Enter attachments S3 bucket origin: ")
    ATTACHMENTS_S3_BUCKET="msr-$NAMESPACE-attachments"
    ATTACHMENTS_S3_BUCKET_REGION="us-east-1"
    ATTACHMENTS_ACCESS_KEY=$MINIO_ROOT_USER
    ATTACHMENTS_SECRET_ACCESS_KEY=$MINIO_ROOT_PASSWORD
  fi

  echo -e "\nSet Measure webapp dashboard URL"
  echo -e "Example: https://measure.yourcompany.com"
  NEXT_PUBLIC_SITE_URL=$(prompt_value_manual "Enter URL to access Measure dashboard: ")

  echo -e "\nSet Measure service URL"
  echo -e "Example: https://measureapi.yourcompany.com"
  NEXT_PUBLIC_API_BASE_URL=$(prompt_value_manual "Enter URL to Measure API service: ")

  echo -e "\nSet Google OAuth"
  echo -e "To create a Google OAuth app, visit: https://support.google.com/cloud/answer/6158849?hl=en"
  OAUTH_GOOGLE_KEY=$(prompt_value_manual "Enter Google oauth app key: ")

  echo -e "\nSet GitHub OAuth"
  echo -e "To create a GitHub OAuth app, visit: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app"
  OAUTH_GITHUB_KEY=$(prompt_value_manual "Enter GitHub oauth app key: ")
  OAUTH_GITHUB_SECRET=$(prompt_password_manual "Enter GitHub oauth app secret: ")
  SESSION_ACCESS_SECRET=$(generate_password 44)
  SESSION_REFRESH_SECRET=$(generate_password 44)

  write_prod_env
fi

echo -e "\nWrote config to $ENV_FILE"