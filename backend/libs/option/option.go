package option

// Option is the functional-option type
// designed for heavy reuse.
type Option[T any] func(*T)

// Apply applies all options
func Apply[T any](config *T, opts ...Option[T]) {
	for _, opt := range opts {
		if opt != nil {
			opt(config)
		}
	}
}

// New creates a config from defaults + options
func New[T any](defaults T, opts ...Option[T]) *T {
	config := defaults
	Apply(&config, opts...)
	return &config
}
