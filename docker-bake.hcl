target "docker-metadata-action" {}

target "api" {
  inherits = ["docker-metadata-action"]
  context = "backend/api"
  contexts = {
    libs = "backend/libs"
    email = "backend/email"
    autumn = "backend/autumn"
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
    api = "backend/api"
    autumn = "backend/autumn"
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
    api = "backend/api"
    email = "backend/email"
    autumn = "backend/autumn"
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
    email = "backend/email"
    autumn = "backend/autumn"
  }
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64"]
}

target "symboloader" {
  inherits = ["docker-metadata-action"]
  context = "backend/symboloader"
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64"]
}

target "cleanup" {
  inherits = ["docker-metadata-action"]
  context = "backend/cleanup"
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
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64"]
}
