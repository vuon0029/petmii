# Implementation Plan: petmii Egg Hatch Onboarding

## Overview

This plan implements the petmii egg hatch onboarding feature as an Electron desktop pet app with TypeScript, React 18, and Vite. The implementation follows the onboarding state machine (EGG_READY → HATCHING → NAMING → ACTIVE_PET), covers randomized pet generation, JSON persistence via IPC, CSS placeholder visuals, and dual-window management (main + overlay).

## Tasks

- [x] 1. Set up project structure, types, and core logic modules
  - [x] 1.1 Initialize project scaffolding and configuration
    - Create package.json with name "petmii", set up Vite + Electron + React + TypeScript config
    - Create electron-builder.json with productName "petmii"
    - Create README.md with title "petmii"
    - Set up directory structure: src/main/, src/preload/, src/renderer/, src/renderer/pet/, src/renderer/components/, src/renderer/hooks/, src/renderer/styles/, src/renderer/assets/pet/{mochi,blob,bun,sprout,ghost,star}/ with README.md placeholders
    - _Requirements: 1.1, 1.2, 1.3, 14.1, 14.2, 14.3_

  - [x] 1.2 Define pet type definitions and constants
    - Create src/renderer/pet/petVariant.ts with PetSpecies, PetColor, PetPersonality, PetVariant, PetMood, PetLifeStage, and PetState types
    - Include DEFAULT_PET_STATS and SPECIES_DEFAULT_NAMES constants
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.1, 14.1_

  - [x] 1.3 Implement onboarding state machine logic
    - Create src/renderer/pet/onboarding.ts with AppOnboardingState type
    - Implement VALID_TRANSITIONS map, isValidTransition(), and transitionState() functions
    - Define transitions: EGG_READY→HATCHING, HATCHING→NAMING, NAMING→ACTIVE_PET, ACTIVE_PET→EGG_READY
    - _Requirements: 13.1, 13.7, 13.8_

  - [x] 1.4 Implement random pet generator
    - Create src/renderer/pet/generateRandomPet.ts with generateRandomPetVariant() function
    - Implement uniform random selection from SPECIES, COLORS, PERSONALITIES arrays
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 1.5 Write property test for state machine integrity
    - **Property 1: State Machine Integrity**
    - Test that state transitions only succeed for valid pairs and reject invalid ones
    - Test that state always holds exactly one value
    - **Validates: Requirements 13.1, 13.7, 13.8**

  - [ ]* 1.6 Write unit tests for random pet generator
    - Test that generateRandomPetVariant always returns a valid PetVariant with valid species/color/personality
    - Test uniform distribution over many runs
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2. Implement Electron main process (persistence, IPC, windows)
  - [x] 2.1 Implement pet storage module
    - Create src/main/petStorage.ts with loadPetState(), savePetState(), clearPetState(), and validatePetState() functions
    - Implement atomic write (write to temp file, then rename)
    - Use app.getPath("userData") for storage path
    - Handle missing file, corrupted JSON, invalid fields gracefully (return null)
    - _Requirements: 6.4, 9.1, 9.3, 2.1, 2.4_

  - [x] 2.2 Implement window manager
    - Create src/main/windowManager.ts with createMainWindow(), createOverlayWindow(), closeOverlayWindow() functions
    - Main window: 400x600, title "petmii", contextIsolation true, nodeIntegration false
    - Overlay window: 120x120, transparent, frameless, alwaysOnTop, skipTaskbar
    - _Requirements: 1.1, 8.1, 8.2, 8.3, 8.4_

  - [x] 2.3 Implement IPC handlers and preload script
    - Create src/main/ipcHandlers.ts registering handlers for pet:load, pet:save, pet:clear, window:open-overlay, window:close-overlay, window:update-overlay
    - Create src/preload/preload.ts exposing petmiiAPI via contextBridge
    - _Requirements: 6.4, 9.1, 8.2, 8.4_

  - [x] 2.4 Create main process entry point
    - Create src/main/main.ts that initializes app, registers IPC handlers, creates main window on app ready
    - _Requirements: 2.1, 9.1, 9.2_

  - [ ]* 2.5 Write property test for storage consistency
    - **Property 2: Storage Consistency**
    - Test that saved PetState is always either null/absent or a fully valid object with all required fields
    - Test that partial writes are prevented by atomic operations (write + rename)
    - **Validates: Requirements 6.4, 9.1, 9.3**

  - [ ]* 2.6 Write property test for idempotent initialization
    - **Property 3: Idempotent Initialization**
    - Test that calling loadPet() multiple times returns the same result without side effects
    - **Validates: Requirements 9.1, 9.2**

- [x] 3. Checkpoint - Core logic and main process
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement renderer hooks and state management
  - [x] 4.1 Implement useOnboarding hook
    - Create src/renderer/hooks/useOnboarding.ts
    - Init from storage on mount: if valid PetState → ACTIVE_PET, else → EGG_READY
    - Expose state, petVariant, petState, error, transition, and setter functions
    - _Requirements: 9.1, 9.2, 9.3, 13.1, 13.2_

  - [x] 4.2 Implement usePetState hook
    - Create src/renderer/hooks/usePetState.ts
    - Implement feed(), play(), clean(), rest() actions that update stats and persist via IPC
    - Implement rename() with validation (non-empty, ≤20 chars, trimmed) and persistence
    - Implement reset() that clears storage and returns null
    - _Requirements: 7.1, 10.3, 11.1, 11.2, 11.3_

  - [ ]* 4.3 Write property test for name validation invariant
    - **Property 4: Name Validation Invariant**
    - Test that PetState.name is always non-empty, trimmed, and ≤20 characters after any create or rename operation
    - **Validates: Requirements 5.3, 5.4, 5.5, 11.1, 11.2**

- [x] 5. Implement CSS styles and placeholder visuals
  - [x] 5.1 Create global styles and egg hatch animation CSS
    - Create src/renderer/styles/global.css with base styles and fonts
    - Create src/renderer/styles/egg-hatch.css with egg shape (border-radius oval, gradient fill) and @keyframes egg-crack animation (2s duration)
    - _Requirements: 2.2, 4.2, 12.1_

  - [x] 5.2 Create pet avatar CSS with species shapes, colors, and personality animations
    - Create src/renderer/styles/pet-avatar.css with .pet-avatar base class
    - Implement 6 species shape classes (.pet-species-mochi through .pet-species-star) with distinct silhouettes
    - Implement 6 color classes (.pet-color-cream through .pet-color-yellow)
    - Implement 6 personality animation classes (.pet-personality-sweet through .pet-personality-sassy) with @keyframes
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 5.3 Create remaining component styles
    - Create src/renderer/styles/name-pet.css for naming screen
    - Create src/renderer/styles/pet-details.css for main care window
    - Create src/renderer/styles/stat-bar.css for stat bars
    - Create src/renderer/styles/overlay.css for overlay window
    - _Requirements: 5.1, 7.1, 8.1_

  - [ ]* 5.4 Write property test for CSS class correctness
    - **Property 6: CSS Class Correctness**
    - Test that the pet avatar element always has exactly three variant classes applied simultaneously (one species, one color, one personality)
    - **Validates: Requirements 12.5, 12.6**

- [x] 6. Implement UI components
  - [x] 6.1 Implement PetAvatar and StatBar reusable components
    - Create src/renderer/components/PetAvatar.tsx rendering a div with classes: pet-avatar pet-species-{species} pet-color-{color} pet-personality-{personality}
    - Create src/renderer/components/StatBar.tsx rendering a labeled progress bar (0-100 scale)
    - _Requirements: 7.1, 12.5, 12.6_

  - [x] 6.2 Implement EggHatchScreen component
    - Create src/renderer/components/EggHatchScreen.tsx
    - Display "petmii" title, CSS egg placeholder, "Hatch Egg" button, "Tap to meet your new pet." text
    - When hatching=true: apply egg-crack animation class, disable button, call onAnimationEnd after 2000ms
    - _Requirements: 2.2, 2.3, 4.1, 4.2, 4.3, 4.4_

  - [x] 6.3 Implement NamePetScreen component
    - Create src/renderer/components/NamePetScreen.tsx
    - Display PetAvatar preview of hatched pet
    - Text input with placeholder "Name your pet", pre-filled with species default name
    - Validate: non-empty, ≤20 chars, trim whitespace; show error messages
    - "Confirm" button calls onNameSubmit with trimmed name
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.4 Implement PetDetails component
    - Create src/renderer/components/PetDetails.tsx
    - Display "petmii" header, pet name, species/color/personality label ("{species} · {color} · {personality}")
    - PetAvatar, mood indicator, 5 stat bars, action buttons (Feed, Play, Clean, Rest)
    - Message bubble with lastMessage, Rename button, Reset button
    - _Requirements: 7.1, 7.2_

  - [x] 6.5 Implement RenamePetModal component
    - Create src/renderer/components/RenamePetModal.tsx
    - Pre-fill input with current name, validate same rules as naming (non-empty, ≤20 chars, trimmed)
    - Confirm submits rename, dismiss/cancel closes without changes
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ]* 6.6 Write unit tests for EggHatchScreen, NamePetScreen, and PetDetails
    - Test EggHatchScreen renders egg, button, title; button disabled when hatching
    - Test NamePetScreen pre-fills species name, validates input, calls onNameSubmit
    - Test PetDetails renders stats, name, variant label, action buttons
    - _Requirements: 2.2, 5.1, 5.2, 7.1_

- [x] 7. Wire App root, overlay, and window entry points
  - [x] 7.1 Implement App.tsx root component with state routing
    - Create src/renderer/App.tsx that uses useOnboarding hook
    - Route based on state: EGG_READY/HATCHING → EggHatchScreen, NAMING → NamePetScreen, ACTIVE_PET → PetDetails
    - Handle name submission: create PetState with defaults, generate ID, persist, open overlay, transition to ACTIVE_PET
    - Handle reset: confirm dialog, clear storage, close overlay, transition to EGG_READY
    - Handle rename: update name, persist, update overlay
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 10.1, 10.2, 10.3, 10.4, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [x] 7.2 Implement OverlayApp.tsx and HTML entry points
    - Create src/renderer/OverlayApp.tsx displaying PetAvatar with variant from IPC
    - Create src/renderer/index.html (main window entry) and src/renderer/overlay.html (overlay entry)
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 7.3 Write property test for overlay lifecycle
    - **Property 5: Overlay Lifecycle**
    - Test that overlay window exists if and only if App_Onboarding_State is ACTIVE_PET
    - Test that no dangling overlay windows are permitted after state transitions away from ACTIVE_PET
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

  - [ ]* 7.4 Write integration tests for full onboarding flow
    - Test EGG_READY → HATCHING → NAMING → ACTIVE_PET with storage verification
    - Test reset flow: ACTIVE_PET → EGG_READY with storage cleared
    - Test app restart: load existing PetState → skip to ACTIVE_PET
    - Test corrupted storage: graceful fallback to EGG_READY
    - _Requirements: 9.1, 9.2, 9.3, 10.3, 10.4, 13.1 through 13.8_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- TypeScript is used for all implementation code
- Vitest is the test runner for unit and property-based tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5", "1.6", "2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "2.6"] },
    { "id": 4, "tasks": ["4.1", "4.2", "5.1", "5.2"] },
    { "id": 5, "tasks": ["4.3", "5.3", "5.4", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "6.4", "6.5"] },
    { "id": 7, "tasks": ["6.6", "7.1", "7.2"] },
    { "id": 8, "tasks": ["7.3", "7.4"] }
  ]
}
```
