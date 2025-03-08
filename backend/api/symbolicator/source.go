package symbolicator

// Source represents a symbolicator source.
//
// It is designed to be abstracted over different
// kinds of sources like S3 & GCS sources for all
// app platforms. The idea is to re-use a common
// struct as much as possible.
//
// If in future, more complex need arises where
// it is not possible to re-use or the cost of re-use
// outweighs the benefits, then refactor as necessary.
type Source struct {
	ID          string   `json:"id"`
	Type        string   `json:"type"`
	Bucket      string   `json:"bucket"`
	Prefix      string   `json:"prefix"`
	Region      []string `json:"region,omitempty"`
	PathStyle   bool     `json:"path_style,omitempty"`
	AccessKey   string   `json:"access_key,omitempty"`
	SecretKey   string   `json:"secret_key,omitempty"`
	PrivateKey  string   `json:"private_key,omitempty"`
	ClientEmail string   `json:"client_email,omitempty"`
	Filters     struct {
		FileTypes    []string `json:"filetypes"`
		PathPatterns []string `json:"path_patterns"`
	} `json:"filters"`
	Layout struct {
		Type   string `json:"type"`
		Casing string `json:"casing"`
	} `json:"layout"`
}

// NewS3SourceApple creates an S3 source
// for Apple platform.
func NewS3SourceApple(id, bucket, region, origin, accessKey, secretKey string) (source Source) {
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

// NewS3SourceAndroid creates an S3 source
// for Android platform.
func NewS3SourceAndroid(id, bucket, region, origin, accessKey, secretKey string) (source Source) {
	source.ID = id
	source.Type = "s3"
	source.Bucket = bucket
	source.Prefix = ""
	source.Region = []string{region, origin}
	source.PathStyle = true
	source.AccessKey = accessKey
	source.SecretKey = secretKey
	source.Filters.FileTypes = []string{"proguard"}
	source.Filters.PathPatterns = []string{}
	source.Layout.Type = "unified"
	source.Layout.Casing = "lowercase"

	return
}

// NewGCSSourceApple creates a GCS source
// for Apple platform.
func NewGCSSourceApple(id, bucket, privateKey, clientEmail string) (source Source) {
	source.ID = id
	source.Type = "gcs"
	source.Bucket = bucket
	source.Prefix = ""
	source.PrivateKey = privateKey
	source.ClientEmail = clientEmail
	source.Filters.FileTypes = []string{"mach_debug"}
	source.Filters.PathPatterns = []string{}
	source.Layout.Type = "unified"
	source.Layout.Casing = "lowercase"

	return
}
