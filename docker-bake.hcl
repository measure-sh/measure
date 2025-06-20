target "api" {
  context = "backend/api"
  dockerfile = "dockerfile"
  platforms = ["linux/amd64", "linux/arm64"]
}
