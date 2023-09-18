# Measure Contribution Guidelines

## General worflow
- Every feature or bug must have a task in the [project board](https://github.com/orgs/measure-sh/projects/5)
- Each task gets converted to an issue
- Pull requests must be opened against an existing issue (which in turn contains a linked task in the board)
- All pull requests must be reviewed and approved by at least 1 maintainer before merging

## Writing commit messages
- Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for all commits.
- Follow these `type` rules
    - **fix:** for commits that fixes a bug and must bump semver PATCH.
    - **feat:** for commits that adds new features and must bump semver MINOR
    - **docs:** for commits that modifies user facing documentation
    - **ci:** for commits that modifies CI configuration
    - **chore:** for commits that modifies settings, configurations and everything else
 
