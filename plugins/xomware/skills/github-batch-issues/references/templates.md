# GitHub Batch Issues - Templates & Examples

## Sprint Planning Template

```yaml
# sprint-2025-03.yaml
template_id: "sprint-2025-03"
description: "Sprint March 3-14, 2025 backlog"
repo: "Xomware/product"
default_labels:
  - "sprint"
  - "2025-03"

issues:
  - title: "User profile page redesign"
    description: |
      Redesign user profile page for better UX.
      
      Acceptance Criteria:
      - [ ] Mobile responsive
      - [ ] Dark mode support
      - [ ] Edit profile functionality
      - [ ] Share profile link
    assignee: "designer"
    labels: ["ui", "design"]
    
  - title: "Add dark mode support"
    description: |
      Implement system-wide dark mode toggle.
      
      - [ ] Settings toggle
      - [ ] Persist user preference
      - [ ] Apply to all screens
      - [ ] Test on multiple devices
    assignee: "domgiordano"
    labels: ["feature", "frontend"]
    
  - title: "Optimize API response times"
    description: |
      Profile slow endpoints and optimize.
      
      - [ ] Identify bottlenecks
      - [ ] Implement caching
      - [ ] Query optimization
      - [ ] Load testing
    assignee: "backend-engineer"
    labels: ["performance", "backend"]
    
  - title: "Update authentication documentation"
    description: |
      Update docs for OAuth setup and token management.
      
      - [ ] OAuth flow documentation
      - [ ] Token refresh procedures
      - [ ] Error handling guide
      - [ ] Code examples
    assignee: "tech-writer"
    labels: ["documentation"]
```

## Feature Breakdown Template

```yaml
# feature-mobile-push.yaml
template_id: "feature-mobile-push"
description: "Mobile push notifications feature implementation"
repo: "Xomware/mobile"

parent_issue:
  title: "[Epic] Mobile Push Notifications"
  description: "Track implementation of push notifications feature"
  labels: ["epic", "feature"]

issues:
  # Design Phase
  - title: "[Phase 1] Design - Push Notification Architecture"
    description: |
      Design the push notification system.
      
      - Service provider selection (Firebase, APNs)
      - Notification types and templates
      - Delivery guarantee levels
      - Rate limiting strategy
    order: 1
    
  - title: "Design notification schemas"
    phase: 1
    description: "Define notification data structures and types"
    
  - title: "Design notification templates"
    phase: 1
    description: "Create templates for different notification types"
    
  # Implementation Phase
  - title: "[Phase 2] Implementation - Backend Push Service"
    description: "Implement backend push notification service"
    order: 2
    
  - title: "Implement Firebase integration"
    phase: 2
    depends_on: ["design-notification-schemas"]
    description: "Set up Firebase Cloud Messaging"
    assignee: "backend-engineer"
    labels: ["backend", "firebase"]
    
  - title: "Implement notification queue"
    phase: 2
    description: "Add job queue for reliable delivery"
    assignee: "backend-engineer"
    labels: ["backend"]
    
  - title: "Implement notification endpoints"
    phase: 2
    depends_on: ["implement-firebase-integration"]
    description: "Create REST endpoints for sending notifications"
    assignee: "backend-engineer"
    
  # iOS Implementation
  - title: "[Phase 3] Implementation - iOS App"
    description: "Implement iOS push notification handling"
    order: 3
    
  - title: "Implement APNs setup"
    phase: 3
    depends_on: ["design-notification-schemas"]
    description: "Configure Apple Push Notifications"
    assignee: "ios-engineer"
    
  - title: "Implement notification handling in app"
    phase: 3
    depends_on: ["implement-apns-setup"]
    description: "Handle foreground, background notifications"
    assignee: "ios-engineer"
    
  - title: "Implement notification settings UI"
    phase: 3
    description: "Allow users to configure notification preferences"
    assignee: "ios-engineer"
    
  # Testing Phase
  - title: "[Phase 4] Testing"
    description: "Testing push notifications"
    order: 4
    
  - title: "Unit tests - Backend"
    phase: 4
    depends_on: ["implement-notification-endpoints"]
    assignee: "qa-engineer"
    
  - title: "Integration tests"
    phase: 4
    depends_on: [
      "implement-notification-handling-in-app",
      "implement-notification-endpoints"
    ]
    assignee: "qa-engineer"
    
  - title: "User acceptance testing"
    phase: 4
    depends_on: ["integration-tests"]
    assignee: "qa-engineer"
```

## Bug Triage Template

```yaml
# critical-bugs-2025-03.yaml
template_id: "critical-bugs-2025-03"
description: "Critical bugs found in production"
repo: "Xomware/core"
default_labels: ["bug", "critical"]

issues:
  - title: "[P0] Login fails intermittently on iOS"
    description: |
      **Impact**: Users cannot log in on iOS devices (30% of user base)
      **Reproduction**: Sometimes fails after 3+ login attempts
      **Workaround**: Restart app and try again
      
      This is causing high support volume.
    assignee: "mobile-engineer"
    labels: ["critical", "ios"]
    
  - title: "[P1] Memory leak in background service"
    description: |
      Memory usage grows unbounded during background sync.
      
      - Suspect in: BackgroundSyncService
      - Impact: App crashes after ~30 mins of background sync
      - Reproduction: Enable background sync, let app run in background
    assignee: "backend-engineer"
    labels: ["critical", "memory"]
    
  - title: "[P1] API rate limiting not working"
    description: |
      Rate limiting middleware is not enforcing limits.
      
      Attackers can abuse endpoints with no throttling.
      
      Urgency: Security issue
    assignee: "backend-engineer"
    labels: ["critical", "security"]
    
  - title: "[P2] Typo in settings page"
    description: |
      'Prefernce' should be 'Preference' on Settings screen.
      
      Minor UX issue.
    assignee: null
    labels: ["low-priority", "ui"]
```

## Documentation Template

```yaml
# docs-api-v2.yaml
template_id: "docs-api-v2"
description: "Documentation for API v2 release"
repo: "Xomware/api"
default_labels: ["documentation", "api-v2"]

issues:
  - title: "Write API v2 Overview"
    description: |
      High-level overview of API v2 design and improvements.
      
      Should include:
      - What's new
      - Breaking changes
      - Migration guide
      - Timeline
    assignee: "tech-writer"
    
  - title: "Document endpoint: GET /users"
    description: |
      API reference for user list endpoint.
      
      Include:
      - Request parameters
      - Response schema
      - Examples (success and error)
      - Rate limits
    assignee: "tech-writer"
    
  - title: "Document endpoint: POST /auth/login"
    description: |
      API reference for login endpoint.
      
      - Request/response schemas
      - Error codes and meanings
      - Example usage
      - Security considerations
    assignee: "tech-writer"
    
  - title: "Write migration guide v1 → v2"
    description: |
      Step-by-step guide for migrating from API v1 to v2.
      
      - Updated imports
      - New authentication method
      - Endpoint mapping
      - Error handling changes
    assignee: "tech-writer"
    
  - title: "Create API v2 SDK documentation"
    description: |
      Document official SDKs for API v2.
      
      - Installation
      - Authentication
      - Usage examples
      - Error handling
    assignee: "tech-writer"
```

## Infrastructure Setup Template

```yaml
# infra-docker-setup.yaml
template_id: "infra-docker-setup"
description: "Docker environment setup for local development"
repo: "Xomware/ops"
default_labels: ["infrastructure", "docker"]

issues:
  - title: "Create docker-compose.yml"
    description: |
      Set up Docker Compose for local dev environment.
      
      Services needed:
      - [ ] PostgreSQL database
      - [ ] Redis cache
      - [ ] API backend
      - [ ] Frontend dev server
      - [ ] Email service (Mailhog)
      
      Requirements:
      - Volume mounts for code
      - Environment variables
      - Port mappings
      - Health checks
    assignee: "devops-engineer"
    
  - title: "Create database initialization scripts"
    description: |
      Scripts to initialize database for local development.
      
      - [ ] Schema creation
      - [ ] Seed data
      - [ ] Test data fixtures
      - [ ] Migration rollback scripts
    depends_on: ["create-docker-composeyml"]
    assignee: "devops-engineer"
    
  - title: "Document local setup process"
    description: |
      Complete setup guide for new developers.
      
      - [ ] Prerequisites (Docker, etc.)
      - [ ] Step-by-step setup
      - [ ] Verification steps
      - [ ] Common issues & solutions
      - [ ] Cleanup instructions
    depends_on: ["create-docker-composeyml"]
    assignee: "tech-writer"
    
  - title: "Create Makefile for common tasks"
    description: |
      Makefile to simplify common development tasks.
      
      Targets:
      - [ ] make setup
      - [ ] make start
      - [ ] make stop
      - [ ] make logs
      - [ ] make test
      - [ ] make clean
    depends_on: ["create-docker-composeyml"]
    assignee: "devops-engineer"
```

## Testing Template

```yaml
# testing-coverage.yaml
template_id: "testing-coverage"
description: "Improve test coverage to 80%"
repo: "Xomware/core"
default_labels: ["testing", "quality"]

issues:
  - title: "Add unit tests for auth service"
    description: |
      Increase test coverage for AuthService from 45% to 80%.
      
      Coverage gaps:
      - [ ] Token refresh logic
      - [ ] OAuth flow
      - [ ] Error scenarios
      - [ ] Edge cases
      
      Use Jest with 80% line coverage target.
    assignee: "qa-engineer"
    
  - title: "Add integration tests for API"
    description: |
      End-to-end tests for main API flows.
      
      Test cases:
      - [ ] User registration flow
      - [ ] Login flow
      - [ ] API endpoint authorization
      - [ ] Error handling
    depends_on: ["add-unit-tests-for-auth-service"]
    assignee: "qa-engineer"
    
  - title: "Set up CI coverage reporting"
    description: |
      Integrate coverage reports into GitHub Actions.
      
      - [ ] Run coverage in CI
      - [ ] Report results in PR
      - [ ] Enforce minimum coverage
      - [ ] Track trends over time
    assignee: "devops-engineer"
    
  - title: "Document testing best practices"
    description: |
      Guide for team on testing practices.
      
      - [ ] Unit test structure
      - [ ] Integration test patterns
      - [ ] Mocking strategies
      - [ ] Coverage goals
    assignee: "tech-writer"
```

## Real-World Examples

### E-commerce Platform

```yaml
template_id: "ecommerce-payment"
description: "Payment processing implementation"
repo: "Xomware/ecommerce"

issues:
  - title: "Design payment flow"
    description: "Design secure payment processing flow"
    
  - title: "Implement Stripe integration"
    description: "Add Stripe payment provider"
    depends_on: ["design-payment-flow"]
    
  - title: "Implement PayPal integration"
    description: "Add PayPal payment provider"
    depends_on: ["design-payment-flow"]
    
  - title: "Add payment security tests"
    description: "PCI compliance testing"
    depends_on: ["implement-stripe-integration"]
    
  - title: "Write payment documentation"
    description: "Setup guide and best practices"
    depends_on: ["implement-stripe-integration"]
```

### Data Migration

```yaml
template_id: "migration-v1-to-v2"
description: "Migrate user data from v1 to v2"
repo: "Xomware/migrations"

issues:
  - title: "Design migration strategy"
    description: "Plan data migration with zero downtime"
    
  - title: "Create migration scripts"
    description: "ETL scripts for data transformation"
    depends_on: ["design-migration-strategy"]
    
  - title: "Test migration with staging data"
    description: "Validate migration on staging environment"
    depends_on: ["create-migration-scripts"]
    
  - title: "Create rollback procedures"
    description: "Ensure we can revert if needed"
    depends_on: ["test-migration-with-staging-data"]
    
  - title: "Write migration runbook"
    description: "Step-by-step guide for production migration"
    depends_on: ["test-migration-with-staging-data"]
```
