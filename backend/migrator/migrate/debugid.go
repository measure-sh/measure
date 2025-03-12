package migrate

import "github.com/google/uuid"

// deubug computes the proguard compatible
// debug id for the DIF.
func debugid(data, domain []byte) (id uuid.UUID) {
	namespace := uuid.NewSHA1(uuid.NameSpaceDNS, domain)
	id = uuid.NewSHA1(namespace, data)
	return
}
