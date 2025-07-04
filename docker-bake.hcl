target "api" {
  context = "backend/api"
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
