target "docker-metadata-action" {}

target "api" {
  context = "backend/api"
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64", "linux/arm64"]
}

target "alerts" {
  context = "backend/alerts"
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64", "linux/arm64"]
}

target "symboloader" {
  context = "backend/symboloader"
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64", "linux/arm64"]
}

target "metering" {
  inherits = ["docker-metadata-action"]
  context = "backend/metering"
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64", "linux/arm64"]
}

target "cleanup" {
  context = "backend/cleanup"
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64", "linux/arm64"]
}

target "dashboard" {
  context = "frontend/dashboard"
  dockerfile = "dockerfile.prod"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64"]
}
