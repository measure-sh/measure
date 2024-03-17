package app

// Resource represents the required fields used by the
// program for sending build info with the request.
type Resource struct {
	AppVersion  string `json:"app_version" binding:"required"`
	AppBuild    string `json:"app_build" binding:"required"`
	AppUniqueID string `json:"app_unique_id" binding:"required"`
}
