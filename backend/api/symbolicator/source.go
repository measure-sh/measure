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
	// ID is the id of the source. Can be freely
	// chosen and is used to identify cache files
	// in the cache folder.
	ID string `json:"id"`
	// Type defines the type of the source
	// http, s3 or gcs
	Type string `json:"type"`
	// Bucket is the name of the bucket.
	Bucket string `json:"bucket"`
	// Prefix is the path prefix to put
	// in front of all keys.
	Prefix string `json:"prefix"`
	// Region is the AWS region where the
	// bucket is located. For S3 compatible
	// service pass a tuple:
	// ["custom-region-name", "http://minio-address/"]
	Region []string `json:"region,omitempty"`
	// PathStyle when true uses path style URLs.
	PathStyle bool `json:"path_style,omitempty"`
	// AccessKey is the AWS access key to use.
	AccessKey string `json:"access_key,omitempty"`
	// SecretKey is the AWS secret key to use.
	SecretKey string `json:"secret_key,omitempty"`
	// PrivateKey is the Google Cloud Storage private
	// key.
	PrivateKey string `json:"private_key,omitempty"`
	// ClientEmail is the Google Cloud Storage email
	// for authentication.
	ClientEmail string `json:"client_email,omitempty"`
	// Filters are a set of filters to reduce the
	// number of unnecessary hits on a symbol server.
	Filters struct {
		// FileTypes is a list of file types to restrict
		// the server to.
		FileTypes []string `json:"filetypes"`
		// PathPatterns is a list of glob matches to be
		// matched on the image name. If the debug image
		// has no name it will never match.
		PathPatterns []string `json:"path_patterns"`
	} `json:"filters"`
	// Layout configures the file system layout of the
	// sources.
	Layout struct {
		// Type defines the general layout of the
		// directory.
		Type string `json:"type"`
		// Casing enforces a casing style.
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
	source.Filters.FileTypes = []string{"proguard", "elf_debug"}
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

// NewGCSSourceAndroid creates a GCS source for
// Android platform.
func NewGCSSourceAndroid(id, bucket, privateKey, clientEmail string) (source Source) {
	source.ID = id
	source.Type = "gcs"
	source.Bucket = bucket
	source.Prefix = ""
	source.PrivateKey = privateKey
	source.ClientEmail = clientEmail
	source.Filters.FileTypes = []string{"proguard", "elf_debug"}
	source.Filters.PathPatterns = []string{}
	source.Layout.Type = "unified"
	source.Layout.Casing = "lowercase"

	return
}
