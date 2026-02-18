package journey

import (
	"backend/api/group"
	"backend/api/set"
)

// Journey is the interface to express
// and operate journey maps.
type Journey interface {
	// GetEdgeSessionCount computes the count of sessions
	// for the edge `v->w`.
	GetEdgeSessionCount(v, w int) int

	// GetNodeName provides the node name mapped to
	// the vertex's index.
	GetNodeName(v int) string

	// GetNodeVertices provides the graph's node
	// vertices in ascending sorted order.
	GetNodeVertices() []int

	// String generates a graph represented
	// in the graphviz dot format.
	String() string

	// GetNodeANRCount computes total count of ANR events
	// occurring in the ANR group.
	// GetNodeANRCount(v int, anrGroupId uuid.UUID) (anrCount int)

	// GetNodeExceptionCount computes total count of exception
	// // events occurring in the exception group.
	// GetNodeExceptionCount(v int, exceptionGroupId uuid.UUID) (crashCount int)

	// IterNodeExceptions iterates over each node passing
	// down exception event ids and expecting matching
	// // exception groups.
	// IterNodeExceptions(iterator func(eventIds []uuid.UUID) (exceptionGroups []group.ExceptionGroup, err error)) (err error)

	// IterNodeANRs iterates over each node passing
	// down exception event ids and expecting matching
	// // exception groups.
	// IterNodeANRs(iterator func(eventIds []uuid.UUID) (anrGroups []group.ANRGroup, err error)) (err error)

	// GetNodeExceptionGroups gets the exception group for
	// // a node. Matches with node's string.
	// GetNodeExceptionGroups(name string) (exceptionGroups []group.ExceptionGroup)

	// SetNodeExceptionGroups iterates over each node passing
	// down exception event ids and expecting matching
	// exception groups. It applies received exception
	// // groups to the journey.
	// SetNodeExceptionGroups(iterator func(eventIds []uuid.UUID) (exceptionGroups []group.ExceptionGroup, err error)) (err error)

	// GetNodeANRGroups gets the anr group for
	// // a node. Matches with node's string.
	// GetNodeANRGroups(name string) (anrGroups []group.ANRGroup)

	// SetNodeANRGroups iterates over each node passing
	// down exception event ids and expecting matching
	// exception groups. It applies received exception
	// groups to the journey.
	// SetNodeANRGroups(iterator func(eventIds []uuid.UUID) (anrGroups []group.ANRGroup, err error)) (err error)
}

// Options is the options to
// configure journey's properties.
type Options struct {
	// BiGraph is true if bidirectional
	// journey creation should create
	// backlinks.
	BiGraph bool

	// ExceptionGroup limits journey
	// creation to be bound by exceptions
	// from the exception group.
	ExceptionGroup *group.ExceptionGroup

	// ANRGroup limits journey creation
	// to be bound by ANRs from the ANR
	// group.
	ANRGroup *group.ANRGroup
}

// nodebag represents a journey
// graph's node's additional
// properties like vertex index,
// node index, issue ids and
// issue groups.
type nodebag struct {
	// vertex is the vertex id
	// of the graph's node.
	vertex int

	// nodeid is the id of the
	// node.
	nodeid int

	// exceptionFingerprints is the list
	// of exception events fingerprints.
	exceptionFingerprints []string

	// anrFingerprints is the list
	// of ANR events fingerprints.
	anrFingerprints []string

	// exceptionIds stores a set
	// of UUIDs associated with
	// this node.
	exceptionIds *set.UUIDSet

	// anrIds stores a set of
	// UUIDs associated with
	// this node.
	anrIds *set.UUIDSet

	// exceptionGroups stores a
	// slice of exception groups
	// associated with this node.
	exceptionGroups []group.ExceptionGroup

	// anrGroups stores a slice of
	// anr groups associated with
	// this node.
	anrGroups []group.ANRGroup
}
