package concur

import "sync"

// GlobalWg is a process wide wait group.
//
// Used for synchronizing various concurrent
// operations.
var GlobalWg sync.WaitGroup
