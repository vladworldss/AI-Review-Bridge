# GitLab AI Review Bridge — common project tasks.
#
# Plasmo browser extension (npm). Run `make help` to list targets.

# Use bash and fail fast on errors / unset vars / failed pipes.
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

NPM := npm

# Plasmo build output directories (see .gitignore).
BUILD_DIRS := build .plasmo .parcel-cache .cache

.DEFAULT_GOAL := help

# ---------------------------------------------------------------------------
# Meta
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

.PHONY: install
install: ## Install dependencies (npm ci — reproducible, from lockfile)
	$(NPM) ci

.PHONY: deps
deps: ## Install/update dependencies (npm install — may update lockfile)
	$(NPM) install

node_modules: package.json package-lock.json ## Install deps if stale
	$(NPM) ci
	@touch node_modules

# ---------------------------------------------------------------------------
# Develop / Build
# ---------------------------------------------------------------------------

.PHONY: dev
dev: node_modules ## Run Plasmo dev server (watch + HMR)
	$(NPM) run dev

.PHONY: build
build: node_modules ## Production build (build/chrome-mv3-prod)
	$(NPM) run build

.PHONY: package
package: build ## Build, then zip the extension for distribution
	$(NPM) run package

# ---------------------------------------------------------------------------
# Quality
# ---------------------------------------------------------------------------

.PHONY: typecheck
typecheck: node_modules ## Type-check with tsc (no emit)
	$(NPM) run typecheck

.PHONY: test
test: node_modules ## Run the test suite once (vitest run)
	$(NPM) test

.PHONY: test-watch
test-watch: node_modules ## Run tests in watch mode
	$(NPM) run test:watch

.PHONY: check
check: typecheck test ## Type-check + tests (run before committing)

# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------

.PHONY: clean
clean: ## Remove build artifacts and caches
	rm -rf $(BUILD_DIRS)

.PHONY: distclean
distclean: clean ## clean + remove node_modules and packaged zips
	rm -rf node_modules
	rm -f *.zip
