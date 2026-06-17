# Requirements Document

## Introduction

This document defines the requirements for the petmii egg hatch onboarding feature. Instead of starting with a default pet, new users hatch a randomized pet from an egg, name it, and then proceed to the main care interface. The feature covers the complete first-launch experience including randomized pet generation, naming flow, persistence, and onboarding state management.

## Glossary

- **Petmii_App**: The Electron desktop pet application named "petmii"
- **Egg_Hatch_Screen**: The initial screen shown to first-time users displaying an egg and a hatch button
- **Name_Pet_Screen**: The screen shown after hatching where the user enters a name for their pet
- **Main_Care_Window**: The primary application window showing pet stats, actions, and details
- **Overlay_Window**: A secondary always-on-top window displaying the pet avatar
- **Pet_Variant**: A combination of species, color, and personality that defines a pet's visual and behavioral identity
- **Pet_Species**: One of six pet types: mochi, blob, bun, sprout, ghost, or star
- **Pet_Color**: One of six colors: cream, pink, blue, mint, lavender, or yellow
- **Pet_Personality**: One of six traits: sweet, chaotic, sleepy, curious, shy, or sassy
- **PetState**: The persistent data model storing all pet attributes and stats
- **App_Onboarding_State**: The current state of the onboarding flow: NO_PET, EGG_READY, HATCHING, NAMING, or ACTIVE_PET
- **Random_Pet_Generator**: A centralized function that produces a randomized Pet_Variant
- **Pet_Storage**: The persistent storage layer that saves and loads PetState

## Requirements

### Requirement 1: App Naming

**User Story:** As a user, I want the application to be consistently branded as "petmii", so that I have a clear and recognizable app identity.

#### Acceptance Criteria

1. THE Petmii_App SHALL display the exact lowercase string "petmii" as the application name in the UI header and the window title.
2. THE Petmii_App SHALL set the application name to "petmii" (lowercase) in the package metadata name field and in the README title heading.
3. IF the app name is rendered in any branding location (UI header, window title, package metadata, or README), THEN THE Petmii_App SHALL use the exact lowercase spelling "petmii" without capitalization or variation.

### Requirement 2: First Launch Egg Screen

**User Story:** As a new user, I want to see an egg hatch screen on first launch, so that I have an engaging onboarding experience.

#### Acceptance Criteria

1. WHEN the Petmii_App launches and no pet exists in Pet_Storage or the Pet_Storage data is invalid or corrupted, THE Petmii_App SHALL display the Egg_Hatch_Screen.
2. THE Egg_Hatch_Screen SHALL display the app name "petmii", a placeholder egg visual, a "Hatch Egg" button, and the text "Tap to meet your new pet."
3. WHILE the App_Onboarding_State is EGG_READY, THE Petmii_App SHALL keep the Egg_Hatch_Screen visible.
4. IF Pet_Storage is inaccessible or contains corrupted data, THEN THE Petmii_App SHALL default to showing the Egg_Hatch_Screen rather than crashing or showing a blank state.

### Requirement 3: Randomized Pet Generation

**User Story:** As a user, I want my pet to be randomly generated when I hatch the egg, so that each user gets a unique pet.

#### Acceptance Criteria

1. WHEN the user clicks the "Hatch Egg" button, THE Random_Pet_Generator SHALL randomly select one Pet_Species from: mochi, blob, bun, sprout, ghost, or star, with uniform probability (each having approximately 1/6 chance).
2. WHEN the user clicks the "Hatch Egg" button, THE Random_Pet_Generator SHALL randomly select one Pet_Color from: cream, pink, blue, mint, lavender, or yellow, with uniform probability independent of the selected Pet_Species.
3. WHEN the user clicks the "Hatch Egg" button, THE Random_Pet_Generator SHALL randomly select one Pet_Personality from: sweet, chaotic, sleepy, curious, shy, or sassy, with uniform probability independent of the selected Pet_Species and Pet_Color.
4. THE Random_Pet_Generator SHALL return a Pet_Variant containing the selected species, color, and personality.
5. IF the Random_Pet_Generator fails to produce a valid Pet_Variant, THEN THE Petmii_App SHALL retry generation up to 3 times before displaying an error message and remaining on the Egg_Hatch_Screen.

### Requirement 4: Hatch Animation Transition

**User Story:** As a user, I want to see a visual transition when hatching, so that the experience feels engaging.

#### Acceptance Criteria

1. WHEN the user clicks the "Hatch Egg" button, THE Petmii_App SHALL transition the App_Onboarding_State from EGG_READY to HATCHING.
2. WHILE the App_Onboarding_State is HATCHING, THE Petmii_App SHALL display a visible hatch animation lasting between 1500 and 3000 milliseconds that includes at least one observable visual change to the egg element (such as movement, scaling, opacity change, or removal).
3. WHILE the App_Onboarding_State is HATCHING, THE Petmii_App SHALL disable user interaction with the "Hatch Egg" button and any navigation controls until the animation completes.
4. WHEN the hatch animation duration elapses, THE Petmii_App SHALL transition the App_Onboarding_State from HATCHING to NAMING.

### Requirement 5: Pet Naming

**User Story:** As a user, I want to name my pet after it hatches, so that I can personalize my companion.

#### Acceptance Criteria

1. WHILE the App_Onboarding_State is NAMING, THE Petmii_App SHALL display the Name_Pet_Screen with a text input field.
2. THE Name_Pet_Screen SHALL display a placeholder text "Name your pet" in the input field and pre-fill the input with a default name based on the generated Pet_Species: "Mochi" for mochi, "Bobo" for blob, "Bun" for bun, "Sprout" for sprout, "Boo" for ghost, or "Star" for star.
3. IF the user submits a name that is empty or contains only whitespace characters, THEN THE Name_Pet_Screen SHALL prevent submission and display an indication that a non-empty name is required.
4. IF the user submits a name that exceeds 20 characters in length, THEN THE Name_Pet_Screen SHALL prevent submission and display an indication that the name must be 20 characters or fewer.
5. WHEN the user submits a name that is non-empty, not whitespace-only, and 20 characters or fewer, THE Petmii_App SHALL trim leading and trailing whitespace from the name and save the result in PetState.name.

### Requirement 6: Pet State Creation After Naming

**User Story:** As a user, I want my pet's data to be fully initialized after naming, so that I can start caring for it immediately.

#### Acceptance Criteria

1. WHEN the user submits a valid pet name, THE Petmii_App SHALL create a PetState with the following default stats (each on a scale of 0 to 100): hunger at 75, happiness at 70, energy at 80, cleanliness at 85, bond at 10, mood as "happy", lifeStage as "baby", and lastMessage as "Your new pet hatched!"
2. WHEN the user submits a valid pet name, THE Petmii_App SHALL store the generated Pet_Variant (species, color, personality) in the PetState.
3. WHEN the user submits a valid pet name, THE Petmii_App SHALL record the current timestamp in PetState.hatchedAt, PetState.createdAt, and PetState.updatedAt, where all three timestamps are identical at creation time.
4. WHEN the PetState is created, THE Petmii_App SHALL persist the complete PetState (name, stats, Pet_Variant, and timestamps) to Pet_Storage as a single atomic write operation.
5. WHEN the PetState is persisted, THE Petmii_App SHALL transition the App_Onboarding_State from NAMING to ACTIVE_PET.
6. IF the PetState fails to persist to Pet_Storage, THEN THE Petmii_App SHALL display an error message indicating that pet creation failed, retain the App_Onboarding_State as NAMING, and allow the user to retry submission.

### Requirement 7: Main Care Window Display

**User Story:** As a user, I want to see my pet's details and stats in the main window, so that I can monitor and interact with my pet.

#### Acceptance Criteria

1. WHILE the App_Onboarding_State is ACTIVE_PET, THE Main_Care_Window SHALL display: the app name "petmii", the pet name, a species/color/personality label in the format "{species} · {color} · {personality}", a pet avatar, the current mood, stat bars (each representing values from 0 to 100) for hunger/happiness/energy/cleanliness/bond, action buttons (feed, play, clean, rest), a message bubble displaying PetState.lastMessage, a rename option, and a reset pet option.
2. THE Main_Care_Window SHALL apply CSS classes based on the Pet_Variant: pet-species-{species}, pet-color-{color}, and pet-personality-{personality}.

### Requirement 8: Overlay Window Behavior

**User Story:** As a user, I want the overlay to only show my pet after it has been hatched and named, so that the overlay is meaningful.

#### Acceptance Criteria

1. WHILE the App_Onboarding_State is ACTIVE_PET, THE Overlay_Window SHALL display the pet avatar applying the same CSS classes (pet-species-{species}, pet-color-{color}, pet-personality-{personality}) as the Main_Care_Window.
2. WHEN the App_Onboarding_State transitions to ACTIVE_PET, THE Petmii_App SHALL open the Overlay_Window displaying the pet avatar.
3. WHILE the App_Onboarding_State is not ACTIVE_PET, THE Petmii_App SHALL not open the Overlay_Window.
4. WHEN the App_Onboarding_State transitions away from ACTIVE_PET (e.g., on pet reset), THE Petmii_App SHALL close the Overlay_Window.

### Requirement 9: Persistence and App Restart

**User Story:** As a returning user, I want my pet to load automatically when I reopen the app, so that I do not repeat the onboarding flow.

#### Acceptance Criteria

1. WHEN the Petmii_App launches and a valid PetState exists in Pet_Storage (containing all required fields: id, name, species, color, personality, hunger, happiness, energy, cleanliness, bond, mood, lifeStage, hatchedAt, createdAt, and updatedAt), THE Petmii_App SHALL load the saved PetState and set App_Onboarding_State to ACTIVE_PET.
2. WHEN the Petmii_App launches and a valid PetState exists in Pet_Storage, THE Petmii_App SHALL skip the Egg_Hatch_Screen and display the Main_Care_Window directly.
3. IF the PetState in Pet_Storage is missing required fields or contains invalid data, THEN THE Petmii_App SHALL treat the storage as empty and set App_Onboarding_State to EGG_READY.

### Requirement 10: Pet Reset

**User Story:** As a user, I want to reset my pet and start over, so that I can experience the egg hatch flow again.

#### Acceptance Criteria

1. WHEN the user selects the reset pet option, THE Petmii_App SHALL display a confirmation prompt asking the user to confirm the reset action before proceeding.
2. IF the user cancels the reset confirmation, THEN THE Petmii_App SHALL dismiss the confirmation prompt and retain the current PetState without changes.
3. WHEN the user confirms the reset action, THE Petmii_App SHALL clear the PetState from Pet_Storage and transition the App_Onboarding_State from ACTIVE_PET to NO_PET, then immediately to EGG_READY.
4. WHEN the App_Onboarding_State transitions to EGG_READY after a reset, THE Petmii_App SHALL display the Egg_Hatch_Screen.

### Requirement 11: Pet Renaming

**User Story:** As a user, I want to rename my pet later from the settings area, so that I can change my mind about the name.

#### Acceptance Criteria

1. WHEN the user selects the rename option in the Main_Care_Window, THE Petmii_App SHALL display a text input pre-filled with the current pet name and limited to a maximum of 20 characters.
2. IF the user submits a name that is empty or contains only whitespace during renaming, THEN THE Petmii_App SHALL prevent the rename, retain the current pet name, and indicate that a non-empty name is required.
3. WHEN the user submits a valid non-empty name during renaming, THE Petmii_App SHALL update PetState.name, record the current timestamp in PetState.updatedAt, persist the change to Pet_Storage, and display the updated name in the Main_Care_Window.
4. IF the user dismisses the rename input without submitting, THEN THE Petmii_App SHALL retain the current pet name unchanged and close the rename input.

### Requirement 12: Placeholder Pet Visuals

**User Story:** As a developer, I want CSS-based placeholder visuals for each pet variant, so that the UI reflects the randomized pet without requiring real sprite assets.

#### Acceptance Criteria

1. THE Petmii_App SHALL render placeholder pet visuals using CSS-only techniques (borders, border-radius, background-color, transforms, and animations) without referencing any external image assets or inline image data.
2. THE Petmii_App SHALL render a visually distinct CSS shape (e.g., different border-radius and proportions) for each of the six Pet_Species values (mochi, blob, bun, sprout, ghost, star) so that each species is distinguishable by silhouette alone.
3. THE Petmii_App SHALL apply a distinct visible background or fill color for each of the six Pet_Color values (cream, pink, blue, mint, lavender, yellow) via the corresponding pet-color-{color} CSS class.
4. THE Petmii_App SHALL apply a distinct visual modifier (such as a CSS animation, opacity change, or transform variation) for each of the six Pet_Personality values (sweet, chaotic, sleepy, curious, shy, sassy) via the corresponding pet-personality-{personality} CSS class.
5. THE Petmii_App SHALL apply exactly three CSS classes simultaneously to each rendered pet placeholder element: pet-species-{species}, pet-color-{color}, and pet-personality-{personality}, so that real sprite sheets can replace placeholders without changing the class structure.
6. WHEN any combination of Pet_Species, Pet_Color, and Pet_Personality is assigned to a pet, THE Petmii_App SHALL render the placeholder visual reflecting all three attributes on the Main_Care_Window and Overlay_Window.

### Requirement 13: Onboarding State Management

**User Story:** As a developer, I want a clear state machine for onboarding, so that the app always knows which screen to display.

#### Acceptance Criteria

1. THE Petmii_App SHALL maintain an App_Onboarding_State that is one of: NO_PET, EGG_READY, HATCHING, NAMING, or ACTIVE_PET, and SHALL hold exactly one state at any given time.
2. WHEN the Petmii_App launches with no pet in Pet_Storage or with invalid/corrupted data in Pet_Storage, THE Petmii_App SHALL set App_Onboarding_State to EGG_READY.
3. WHEN the user clicks "Hatch Egg", THE Petmii_App SHALL transition from EGG_READY to HATCHING.
4. WHEN the hatch animation completes (within a maximum duration of 3 seconds), THE Petmii_App SHALL transition from HATCHING to NAMING.
5. WHEN the user submits a valid pet name, THE Petmii_App SHALL transition from NAMING to ACTIVE_PET.
6. WHEN the user resets the pet, THE Petmii_App SHALL transition from ACTIVE_PET directly to EGG_READY without persisting the intermediate NO_PET state as a user-visible screen.
7. IF a state transition is attempted from a source state that does not match the expected source for that transition, THEN THE Petmii_App SHALL reject the transition and remain in the current state.
8. THE Petmii_App SHALL only permit the following state transitions: EGG_READY to HATCHING, HATCHING to NAMING, NAMING to ACTIVE_PET, and ACTIVE_PET to EGG_READY.

### Requirement 14: File and Asset Structure

**User Story:** As a developer, I want a well-organized file structure, so that future sprite sheets can be added per species without restructuring the project.

#### Acceptance Criteria

1. THE Petmii_App SHALL organize pet logic into the following dedicated files under src/renderer/pet/: petVariant.ts containing PetSpecies, PetColor, PetPersonality, and PetVariant type definitions; generateRandomPet.ts containing the generateRandomPetVariant() function; and onboarding.ts containing the AppOnboardingState type and state transition logic.
2. THE Petmii_App SHALL organize UI components into the following files under src/renderer/components/: EggHatchScreen.tsx for the egg hatch display, NamePetScreen.tsx for the naming flow, and PetDetails.tsx for the main care view.
3. THE Petmii_App SHALL provide an asset folder structure at src/renderer/assets/pet/ with one subdirectory per Pet_Species (mochi/, blob/, bun/, sprout/, ghost/, star/) each containing a README.md placeholder noting the expected sprite sheet formats.
