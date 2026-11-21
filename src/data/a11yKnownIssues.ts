// Accessibility baseline for SauceDemo.
//
// SauceDemo is a third-party demo site, so its existing accessibility defects
// cannot be fixed from this repo. Each page's known axe rule IDs are recorded
// here. The accessibility tests fail only when a violation appears that is NOT
// in this list, which is how a team would track accessibility debt on a real
// product: log the known issues, block new ones, and remove entries as they
// get fixed.

export const knownA11yIssues: Record<string, string[]> = {
  login: [],
  inventory: [],
  checkout: [],
};
