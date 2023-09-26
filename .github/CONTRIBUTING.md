# Measure Contribution Guidelines

## General workflow

- Every feature or bug must have a task in the [project board](https://github.com/orgs/measure-sh/projects/5)
- Each task gets converted to an issue
- Pull requests must be opened against an existing issue (which in turn contains a linked task in the board)
- All pull requests must be reviewed and approved by at least 1 maintainer before merging

## Local environment setup

After cloning the repostiory, run the following commands for the best contribution experience. All core maintainers **MUST** follow these steps.

In the repo root, run

```sh
npm install
npm prepare
```

The above commands would install the required dependencies and setup git hooks as intended. This is a one-time setup, unless you do a fresh clone again.

> ⚠ NOTE
>
> You would need [node](https://nodejs.org/) to run the above commands. We recommend you always stick to the `lts` version of node.
> If you need to setup node, we recommend you use [fnm (Fast Node Manager)](https://github.com/Schniz/fnm) to manage node version(s). Follow [fnm's installation instructions](https://github.com/Schniz/fnm?tab=readme-ov-file#installation).


## Writing commit messages

All commits landing in any branch are first linted in your local environment and then in CI.

- Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for all commits.
- Stick to present tense for the commit message language
- Follow these `type` rules
  - **fix:** for commits that fixes a bug and must bump semver PATCH.
  - **feat:** for commits that adds new features and must bump semver MINOR
  - **docs:** for commits that modifies user facing documentation
  - **ci:** for commits that modifies CI configuration
  - **chore:** for commits that modifies settings, configurations and everything else
- Scoping your commits is optional, but encouraged. Allowed scopes are:
  - **android** for commits related to Android SDK
  - **webapp** for commits related to dashboard web app
  - **backend** for commits related to backend infrastructure
- Try not to exceed **72** characters for commit header message
- Try not to exceed **100** characters for each line in body. Break each line with newlines to remain under 100 characters.
- Make sure commit message headers are in lowercase
- Make sure commit message body & footer are always sandwiched with a single blank line

### ❌ Bad Commits

- No `type`

  ```
  fix an issue with session replay
  ```

- Incorrect `scope`

  ```
  feat(foobar): add exception symbolication
  ```

- No newline between header & body

  ```
  feat(backend): add exception symbolication
  Add android symbolication of unhandled exceptions
  ```

- Exceeding `body-max-line-length`

  ```
  fix(backend): frames not ingesting

  this is a really really really long line that is exceeding the allowed limit of max characters per line
  ```

### ✅ Good Commits

- Correct `type`

  ```
  fix: an issue with session replay
  ```

- Correct & allowed `scope`

  ```
  feat(backend): add exception symbolication
  ```

- 1 blank line between header & body

  ```
  feat(backend): add exception symbolication

  Add android symbolication of unhandled exceptions
  ```

- Each body line is within limits

  ```
  fix(backend): frames not ingesting

  this is a really really really long line that is
  exceeding the allowed limit of max characters per line
  ```