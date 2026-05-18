package symbol

const (
	// TypeUnknown represents an unknown
	// type of mapping symbolication.
	TypeUnknown MappingType = iota
	// TypeProguard represents the "proguard"
	// type of mapping symbolication.
	TypeProguard
	// TypeDsym represents the "dSYM"
	// type of mapping symbolication.
	TypeDsym
	// TypeElfDebug represents the "ELF"
	// type of mapping symbolication.
	TypeElfDebug
	// TypeJsBundle represents the "jsbundle"
	// type of mapping symbolication for
	// React Native / JavaScript apps.
	TypeJsBundle
)

// MappingType represents the mapping
// type for internal computational use.
type MappingType int

// String provides the human recognizable
// mapping type.
func (m MappingType) String() string {
	switch m {
	default:
		return "unknown"
	case TypeProguard:
		return "proguard"
	case TypeDsym:
		return "dsym"
	case TypeElfDebug:
		return "elf_debug"
	case TypeJsBundle:
		return "jsbundle"
	}
}
