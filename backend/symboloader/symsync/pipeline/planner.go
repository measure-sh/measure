package pipeline

// Action describes a single archive to fetch.
type Action struct {
	Target Target
}

// DeleteAction describes a single manifest archive to remove.
type DeleteAction struct {
	Entry ArchiveEntry
}

// Plan is the set of actions to execute in this run: archives to fetch and
// archives to remove. The fetcher consumes Actions; the janitor consumes Deletes.
type Plan struct {
	Actions []Action
	Deletes []DeleteAction
}

// DownloadCount returns the number of fetch actions in the plan.
func (p *Plan) DownloadCount() int { return len(p.Actions) }

// DeleteCount returns the number of delete actions in the plan.
func (p *Plan) DeleteCount() int { return len(p.Deletes) }

// NewPlan compares the resolved targets against the manifest:
//   - every target becomes an Action
//   - every active manifest entry not present in targets becomes a DeleteAction
func NewPlan(targets []Target, manifest *Manifest) *Plan {
	actions := make([]Action, len(targets))
	for i, t := range targets {
		actions[i] = Action{Target: t}
	}

	plan := &Plan{Actions: actions}
	if manifest == nil {
		return plan
	}

	wanted := make(map[string]struct{}, len(targets))
	for _, t := range targets {
		wanted[targetVBAC(t)] = struct{}{}
	}

	for _, e := range manifest.Archives {
		if !e.Active() {
			continue
		}
		if _, ok := wanted[e.VBAC()]; ok {
			continue
		}
		plan.Deletes = append(plan.Deletes, DeleteAction{Entry: e})
	}
	return plan
}

// targetVBAC mirrors ArchiveEntry.VBAC for a Target. The planner needs the
// version/build/arch from the filename since Target carries them implicitly.
// Returns a non-collidable sentinel for filenames the parser cannot decode;
// in practice every Target from the spotter is parseable.
func targetVBAC(t Target) string {
	info, ok := ParseArchiveFilename(t.FileName)
	if !ok {
		return "unparsed:" + t.FileID
	}
	return joinVBAC(info.Version, info.Build, info.Arch, t.Checksum)
}
