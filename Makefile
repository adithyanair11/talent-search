# Talent Search — local dev entry points. Assumes only Docker running + Node 24.
# Every target is safe to run repeatedly.

.PHONY: setup dev stop reset demo-paid reset-quota test eval check-prereqs install supabase-up env

SUPABASE := npx supabase

setup: check-prereqs install supabase-up
	$(SUPABASE) db reset
	npx tsx scripts/setup-env.ts
	npm run seed
	@printf '\n✔ Setup complete. Run "make dev" and open http://localhost:3000\n'

dev: check-prereqs supabase-up
	@test -f .env.local || npx tsx scripts/setup-env.ts
	npm run dev

stop:
	$(SUPABASE) stop

# Wipe the local database back to migrations + seed, then re-seed recruiters and candidates.
reset: check-prereqs supabase-up
	$(SUPABASE) db reset
	npm run seed

# Local demos only — never called by setup/dev, which leave both companies free with no billing state.
# Replays data/stripe-events.json through the webhook (needs `make dev` running): globex paid, acme free.
demo-paid:
	npm run replay:stripe

# Local demos only: gives every company its free search back (searches_used = 0). Refuses non-local Supabase.
reset-quota:
	npm run reset:quota

test:
	npm test

eval:
	npm run eval

check-prereqs:
	@command -v node >/dev/null 2>&1 || { echo "✖ Node.js is not installed. Install Node 24 (see .nvmrc)."; exit 1; }
	@major=$$(node -p 'process.versions.node.split(".")[0]'); \
	if [ "$$major" != "24" ]; then \
		echo "✖ Node 24 is required, found $$(node -v). Run 'nvm use' (reads .nvmrc)."; exit 1; \
	fi
	@docker info >/dev/null 2>&1 || { echo "✖ Docker is not running. Start Docker Desktop and retry."; exit 1; }

install:
	@if [ -f package-lock.json ]; then npm ci; else npm install; fi

# No-op when the stack is already up.
supabase-up:
	@$(SUPABASE) status >/dev/null 2>&1 || $(SUPABASE) start
