target "api" {
  context = "backend/api"
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64", "linux/arm64"]
  tags = ["${{ steps.meta.outputs.tags }}"]
}

target "alerts" {
  context = "backend/alerts"
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64", "linux/arm64"]
  tags = ["${{ steps.meta.outputs.tags }}"]
}

target "symboloader" {
  context = "backend/symboloader"
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64", "linux/arm64"]
  tags = ["${{ steps.meta.outputs.tags }}"]
}

target "metering" {
  context = "backend/metering"
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64", "linux/arm64"]
  tags = ["${{ steps.meta.outputs.tags }}"]
}

target "cleanup" {
  context = "backend/cleanup"
  dockerfile = "dockerfile"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64", "linux/arm64"]
  tags = ["${{ steps.meta.outputs.tags }}"]
}

target "dashboard" {
  context = "frontend/dashboard"
  dockerfile = "dockerfile.prod"
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
  platforms = ["linux/amd64"]
  tags = ["${{ steps.meta.outputs.tags }}"]
}
