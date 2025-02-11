package symbolicator

type Source struct {
	ID        string   `json:"id"`
	Type      string   `json:"type"`
	Bucket    string   `json:"bucket"`
	Prefix    string   `json:"prefix"`
	Region    []string `json:"region"`
	PathStyle bool     `json:"path_style"`
	AccessKey string   `json:"access_key"`
	SecretKey string   `json:"secret_key"`
	Filters   struct {
		FileTypes    []string `json:"filetypes"`
		PathPatterns []string `json:"path_patterns"`
	} `json:"filters"`
	Layout struct {
		Type   string `json:"type"`
		Casing string `json:"casing"`
	} `json:"layout"`
}

func NewS3Source(id, bucket, region, origin, accessKey, secretKey string) (source Source) {
	source.ID = id
	source.Type = "s3"
	source.Bucket = bucket
	source.Prefix = ""
	source.Region = []string{region, origin}
	source.PathStyle = true
	source.AccessKey = accessKey
	source.SecretKey = secretKey
	source.Filters.FileTypes = []string{"mach_debug"}
	source.Filters.PathPatterns = []string{}
	source.Layout.Type = "unified"
	source.Layout.Casing = "lowercase"

	return
}
