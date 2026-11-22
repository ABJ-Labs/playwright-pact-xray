// Accessibility known-issues baseline.
//
// When a scan finds an issue that cannot be fixed straight away (for example on a
// third-party page), record its axe rule ID against the page here. The
// accessibility tests then fail only on NEW violations, which is how a team
// tracks accessibility debt: log the known issues, block new ones, and remove
// entries once they are fixed. The tests flag any entry that is no longer found.
//
// The lists are empty because the current scans of these pages are clean.

export const knownA11yIssues: Record<string, string[]> = {
  login: [],
  inventory: [],
  checkout: [],
};
