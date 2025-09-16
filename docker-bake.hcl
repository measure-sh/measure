target "docker-metadata-action" {}

target "api" {
  inherits = ["docker-metadata-action"]
  context = "backend/api"
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64"]
}

target "alerts" {
  inherits = ["docker-metadata-action"]
  context = "backend/alerts"
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

target "metering" {
  inherits = ["docker-metadata-action"]
  context = "backend/metering"
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
  dockerfile = "dockerfile.prod"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64"]
}
