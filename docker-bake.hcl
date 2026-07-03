target "docker-metadata-action" {}

target "api" {
  inherits = ["docker-metadata-action"]
  context = "backend/api"
  contexts = {
    libs = "backend/libs"
  }
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64"]
}

target "ingest-worker" {
  inherits = ["docker-metadata-action"]
  context = "backend/ingest-worker"
  contexts = {
    libs = "backend/libs"
  }
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64"]
}

target "ingest" {
  inherits = ["docker-metadata-action"]
  context = "backend/ingest"
  contexts = {
    libs = "backend/libs"
  }
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64"]
}

target "alerts" {
  inherits = ["docker-metadata-action"]
  context = "backend/alerts"
  contexts = {
    libs = "backend/libs"
  }
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64"]
}

target "symboloader" {
  inherits = ["docker-metadata-action"]
  context = "backend/symboloader"
  contexts = {
    libs = "backend/libs"
  }
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64"]
}

target "cleanup" {
  inherits = ["docker-metadata-action"]
  context = "backend/cleanup"
  contexts = {
    libs = "backend/libs"
  }
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64"]
}

target "agent" {
  inherits = ["docker-metadata-action"]
  context = "backend/agent"
  contexts = {
    libs = "backend/libs"
  }
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64"]
}

target "dashboard" {
  inherits = ["docker-metadata-action"]
  context = "frontend/dashboard"
  contexts = {
    docs = "docs"
  }
  dockerfile = "dockerfile.prod"
  secret = ["id=posthog_sourcemap_personal_key,env=POSTHOG_SOURCEMAP_PERSONAL_KEY"]
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64"]
}
