# Agentic Marketer - Remaining Work

## High Priority

### Polish & Bug Fixes
- [ ] **Follow-up flow improvements** - Planner sometimes re-asks unnecessary questions
- [ ] **Research sources IDs** - Data should include unique IDs for proper React keys
- [ ] **Better error messages** - More descriptive errors for API failures

### Testing
- [ ] Full E2E test: Pipeline mode (new post → questions → research → draft → publish)
- [ ] Full E2E test: Single-agent mode (conversational flow)
- [ ] Test follow-up requests in both modes
- [ ] Test image generation error recovery
- [ ] Test LinkedIn publish flow
- [ ] Test app restart mid-workflow (state restoration)

---

## Medium Priority

### Features
- [ ] **Run deletion** - Delete old runs from sidebar
- [ ] **Post export** - Copy to clipboard, download image separately
- [ ] **Activity feed enhancement** - Show timestamps, more detail
- [ ] **Draft history** - See previous versions before critic improvements

### UI/UX
- [ ] **Keyboard shortcuts** - Ctrl+N for new chat, Ctrl+Enter to send
- [ ] **Dark/light mode** - Theme toggle
- [ ] **Responsive panels** - Better layout on smaller screens
- [ ] **Drag to resize panels** - User-controlled panel sizes

---

## Low Priority / Future

### Additional Orchestration Patterns
- [ ] **Supervisor Mode** - Coordinator delegates to specialists dynamically
- [ ] **Parallel Mode** - Research + Positioning run simultaneously

### Platform Expansion
- [ ] **Twitter/X support** - Different format, character limits
- [ ] **Threads support** - Meta's Twitter alternative
- [ ] **Multi-platform posting** - Post to multiple platforms at once

### Advanced Features
- [ ] **Post scheduling** - Schedule posts for specific times
- [ ] **Analytics dashboard** - Track post performance
- [ ] **Template library** - Reusable post templates
- [ ] **Brand voice settings** - Customize AI writing style
- [ ] **Content calendar** - Plan posts ahead

### Infrastructure
- [ ] **Electron auto-updater** - Push updates automatically
- [ ] **Crash reporting** - Track and report errors
- [ ] **Usage analytics** - Understand feature usage
- [ ] **Cloud sync** - Sync runs across devices

---

## Technical Debt

- [ ] Clean up unused imports across codebase
- [ ] Add proper TypeScript strict mode
- [ ] Add unit tests for orchestrators
- [ ] Add integration tests for IPC handlers
- [ ] Document API for each orchestrator tool
- [ ] Create development setup guide

---

## Notes

- Pipeline mode is the more stable/tested mode
- Single-agent mode is experimental but provides better conversational UX
- Image generation requires OpenAI API key and can fail on complex prompts
- LinkedIn OAuth tokens expire and need refresh handling
