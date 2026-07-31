// Package boot builds the infrastructure handles every service opens at
// startup in the same way.
//
// Each service owns its own boot sequence in its server package, reading its
// own env contract & wiring its own handles. Only the builders that are
// identical across services live here, so a fix lands once instead of five
// times.
//
// # Usage
//
//	if err := boot.WaitForPg(ctx, pgPool, 5*time.Second); err != nil {
//	    fmt.Printf("Postgres pool not ready: %v\n", err)
//	}
//
//	vkClient, err := boot.ConnectValkey(ctx, config.RD.Host, config.RD.Port, "agent", 15*time.Second)
//	if err != nil {
//	    log.Fatalf("Unable to create valkey client: %v", err)
//	}
//
// # Why the two differ
//
// [WaitForPg] is advisory. A pgxpool that fails its ping is still usable, it
// dials lazily & reconnects on its own, so a caller may log & carry on.
//
// [ConnectValkey] is not. valkey-go dials during construction & returns a nil
// client on failure, which no amount of later retrying inside the service will
// repair. Callers should treat its error as fatal & let the orchestrator
// restart them, otherwise the process serves traffic with a nil client that
// panics on first use.
//
// Once built, the valkey client heals its own dropped connections, so only
// construction needs this care.
package boot
