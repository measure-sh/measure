package measure

// Default app error-threshold preference values, applied when an app has no
// explicit threshold prefs configured. Shared between app creation (which
// seeds these defaults) and the threshold-prefs read path.
const (
	DefaultErrorGoodThreshold          = 95.0
	DefaultErrorCautionThreshold       = 85.0
	DefaultErrorSpikeMinCountThreshold = 100
	DefaultErrorSpikeMinRateThreshold  = 0.5
)
