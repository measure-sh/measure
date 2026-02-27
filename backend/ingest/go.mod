module backend/ingest

go 1.25.6

require (
	backend/api v0.0.0
	github.com/gin-gonic/gin v1.10.1
	go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin v0.62.0
)

replace (
	backend/api => ../api
	backend/billing => ../billing
	backend/email => ../email
)
