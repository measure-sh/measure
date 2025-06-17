target "api" {
  context = "backend/api"
  dockerfile = "dockerfile"
  platforms = ["linux/amd64", "linux/arm64"]
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
}
