package config

import (
	"context"
	"errors"
	"fmt"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
)

var ErrMissingCredentials = errors.New("google credentials not configured: set GOOGLE_APPLICATION_CREDENTIALS or use gcloud application-default login")

// DriveCredentials resolves Google credentials for Drive API access via ADC.
// Supports: GOOGLE_APPLICATION_CREDENTIALS env var, gcloud default credentials,
// and Cloud Run metadata server.
func DriveCredentials(ctx context.Context) (creds *google.Credentials, err error) {
	creds, err = google.FindDefaultCredentials(ctx, drive.DriveScope)
	if err != nil {
		err = fmt.Errorf("%w: %w", ErrMissingCredentials, err)
	}
	return
}
