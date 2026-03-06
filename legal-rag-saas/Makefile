.PHONY: setup dev build test deploy logs clean

# Development
setup:
	chmod +x scripts/setup.sh && ./scripts/setup.sh

dev:
	npm run dev

worker:
	npx tsx worker/document-processor.ts

# Docker
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# Database
db-migrate:
	npx prisma migrate dev

db-reset:
	npx prisma migrate reset

db-studio:
	npx prisma studio

# Testing
test:
	npm test

test-watch:
	npm test -- --watch

# Build
build:
	npm run build

# Production
deploy:
	docker-compose -f docker-compose.prod.yml up -d

deploy-build:
	docker-compose -f docker-compose.prod.yml up -d --build

logs:
	docker-compose -f docker-compose.prod.yml logs -f

# Cleanup
clean:
	docker-compose down -v
	docker system prune -f

# Utilities
format:
	npx prettier --write "**/*.{ts,tsx,js,jsx,json,md}"

lint:
	npm run lint

typecheck:
	npx tsc --noEmit
