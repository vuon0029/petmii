# Technical Design: petmii Egg Hatch Onboarding

## Overview

This document describes the technical architecture for the petmii egg hatch onboarding feature. The app is an Electron desktop pet application built with TypeScript, React, and CSS modules. The design covers the onboarding state machine, randomized pet generation, persistence layer, UI component hierarchy, and the Electron main/renderer process communication.

## Components and Interfaces

### Main Process Components

| Component | File | Responsibility |
|-----------|------|---------------|
| WindowManager | src/main/windowManager.ts | Creates and manages main + overlay BrowserWindows |
| PetStorage | src/main/petStorage.ts | JSON file read/write/delete with validation |
| IPCHandlers | src/main/ipcHandlers.ts | Registers IPC handlers bridging renderer to storage/windows |

### Renderer Components

| Component | File | Responsibility |
|-----------|------|---------------|
| App | src/renderer/App.tsx | Root component, routes based on onboarding state |
| OverlayApp | src/renderer/OverlayApp.tsx | Overlay window root, displays pet avatar |
| EggHatchScreen | src/renderer/components/EggHatchScreen.tsx | Egg display, hatch button, animation |
| NamePetScreen | src/renderer/components/NamePetScreen.tsx | Name input, validation, submission |
| PetDetails | src/renderer/components/PetDetails.tsx | Main care window with stats and actions |
| PetAvatar | src/renderer/components/PetAvatar.tsx | CSS placeholder pet rendering |
| StatBar | src/renderer/components/StatBar.tsx | Progress bar for a single stat |
| RenamePetModal | src/renderer/components/RenamePetModal.tsx | Rename dialog with validation |

### Pet Logic Modules

| Module | File | Responsibility |
|--------|------|---------------|
| petVariant | src/renderer/pet/petVariant.ts | Type definitions for species, color, personality, PetState |
| generateRandomPet | src/renderer/pet/generateRandomPet.ts | generateRandomPetVariant() function |
| onboarding | src/renderer/pet/onboarding.ts | AppOnboardingState type, transition validation |

### React Hooks

| Hook | File | Responsibility |
|------|------|---------------|
| useOnboarding | src/renderer/hooks/useOnboarding.ts | State machine management, init from storage |
| usePetState | src/renderer/hooks/usePetState.ts | Pet action handlers (feed, play, clean, rest, rename, reset) |

### Key Interfaces

```typescript
// Preload API exposed to renderer
interface PetmiiAPI {
  loadPet(): Promise<PetState | null>;
  savePet(state: PetState): Promise<boolean>;
  clearPet(): Promise<boolean>;
  openOverlay(): void;
  closeOverlay(): void;
  updateOverlay(variant: PetVariant): void;
}

// IPC Channels
type IPCChannels =
  | "pet:load"
  | "pet:save"
  | "pet:clear"
  | "window:open-overlay"
  | "window:close-overlay"
  | "window:update-overlay";
```

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron Main Process                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ main.ts      │  │ Pet_Storage   │  │ Window Manager        │ │
│  │ (app entry)  │  │ (JSON file)   │  │ (main + overlay)      │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
│         │                  ▲                      ▲              │
│         │                  │ IPC                   │ IPC          │
└─────────┼──────────────────┼──────────────────────┼─────────────┘
          │                  │                      │
┌─────────┼──────────────────┼──────────────────────┼─────────────┐
│         ▼                  ▼                      ▼              │
│                     Electron Renderer Process                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      App.tsx (Root)                         │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │           Onboarding State Machine                   │  │  │
│  │  │  EGG_READY → HATCHING → NAMING → ACTIVE_PET        │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                          │                                 │  │
│  │        ┌─────────────────┼─────────────────┐              │  │
│  │        ▼                 ▼                 ▼              │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐     │  │
│  │  │EggHatch    │  │NamePet     │  │PetDetails      │     │  │
│  │  │Screen      │  │Screen      │  │(Main Care)     │     │  │
│  │  └────────────┘  └────────────┘  └────────────────┘     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Pet Logic Layer                                           │  │
│  │  ┌──────────────┐ ┌──────────────────┐ ┌──────────────┐  │  │
│  │  │petVariant.ts │ │generateRandomPet │ │onboarding.ts │  │  │
│  │  │(types)       │ │.ts (generator)   │ │(state mgmt)  │  │  │
│  │  └──────────────┘ └──────────────────┘ └──────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Onboarding State Machine

```
                    ┌──────────────────────┐
                    │      App Launch       │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Check Pet_Storage    │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │ no valid pet   │                 │ valid pet found
              ▼                                 ▼
    ┌─────────────────┐                ┌─────────────────┐
    │    EGG_READY     │                │   ACTIVE_PET    │
    │ (Egg Hatch UI)   │                │ (Main Care UI)  │
    └────────┬────────┘                └────────┬────────┘
             │ click "Hatch Egg"                │ reset
             ▼                                  │
    ┌─────────────────┐                         │
    │    HATCHING      │                         │
    │ (animation)      │◄───────────────────────┘
    └────────┬────────┘   (transitions to EGG_READY)
             │ animation ends
             ▼
    ┌─────────────────┐
    │     NAMING       │
    │ (name input)     │
    └────────┬────────┘
             │ valid name submitted
             ▼
    ┌─────────────────┐
    │   ACTIVE_PET    │
    │ (Main Care +    │
    │  Overlay opens) │
    └─────────────────┘
```

## Data Models

### PetVariant Types

```typescript
// src/renderer/pet/petVariant.ts

export type PetSpecies = "mochi" | "blob" | "bun" | "sprout" | "ghost" | "star";
export type PetColor = "cream" | "pink" | "blue" | "mint" | "lavender" | "yellow";
export type PetPersonality = "sweet" | "chaotic" | "sleepy" | "curious" | "shy" | "sassy";

export type PetVariant = {
  species: PetSpecies;
  color: PetColor;
  personality: PetPersonality;
};

export type PetMood = "happy" | "sad" | "hungry" | "sleepy" | "playful" | "neutral";

export type PetLifeStage = "egg" | "baby" | "child" | "adult";

export interface PetState {
  id: string;
  name: string;
  species: PetSpecies;
  color: PetColor;
  personality: PetPersonality;
  hunger: number;       // 0-100
  happiness: number;    // 0-100
  energy: number;       // 0-100
  cleanliness: number;  // 0-100
  bond: number;         // 0-100
  mood: PetMood;
  lifeStage: PetLifeStage;
  lastMessage: string;
  lastFedAt: string | null;
  lastPlayedAt: string | null;
  lastCleanedAt: string | null;
  lastRestedAt: string | null;
  hatchedAt: string;
  createdAt: string;
  updatedAt: string;
}
```

### Onboarding State

```typescript
// src/renderer/pet/onboarding.ts

export type AppOnboardingState =
  | "NO_PET"
  | "EGG_READY"
  | "HATCHING"
  | "NAMING"
  | "ACTIVE_PET";

// Valid transitions map
const VALID_TRANSITIONS: Record<AppOnboardingState, AppOnboardingState[]> = {
  NO_PET: ["EGG_READY"],
  EGG_READY: ["HATCHING"],
  HATCHING: ["NAMING"],
  NAMING: ["ACTIVE_PET"],
  ACTIVE_PET: ["EGG_READY"],
};
```

### Default Pet Stats

```typescript
export const DEFAULT_PET_STATS = {
  hunger: 75,
  happiness: 70,
  energy: 80,
  cleanliness: 85,
  bond: 10,
  mood: "happy" as PetMood,
  lifeStage: "baby" as PetLifeStage,
  lastMessage: "Your new pet hatched!",
  lastFedAt: null,
  lastPlayedAt: null,
  lastCleanedAt: null,
  lastRestedAt: null,
} as const;
```

### Species-to-Default-Name Map

```typescript
export const SPECIES_DEFAULT_NAMES: Record<PetSpecies, string> = {
  mochi: "Mochi",
  blob: "Bobo",
  bun: "Bun",
  sprout: "Sprout",
  ghost: "Boo",
  star: "Star",
};
```

## File Structure

```
petmii/
├── package.json                          # name: "petmii"
├── README.md                             # Title: petmii
├── electron-builder.json                 # productName: "petmii"
├── src/
│   ├── main/
│   │   ├── main.ts                       # Electron main process entry
│   │   ├── windowManager.ts             # Creates main + overlay windows
│   │   ├── ipcHandlers.ts              # IPC bridge for storage operations
│   │   └── petStorage.ts               # JSON file-based persistence
│   ├── preload/
│   │   └── preload.ts                   # contextBridge API exposure
│   └── renderer/
│       ├── index.html                    # Main window HTML entry
│       ├── overlay.html                  # Overlay window HTML entry
│       ├── App.tsx                       # Root component with state routing
│       ├── OverlayApp.tsx               # Overlay root component
│       ├── pet/
│       │   ├── petVariant.ts            # Type definitions
│       │   ├── generateRandomPet.ts     # Random variant generator
│       │   └── onboarding.ts            # State machine logic
│       ├── components/
│       │   ├── EggHatchScreen.tsx        # Egg display + hatch button
│       │   ├── NamePetScreen.tsx         # Name input after hatching
│       │   ├── PetDetails.tsx           # Main care window content
│       │   ├── PetAvatar.tsx            # Reusable CSS pet placeholder
│       │   ├── StatBar.tsx              # Reusable stat bar component
│       │   └── RenamePetModal.tsx       # Rename dialog
│       ├── hooks/
│       │   ├── useOnboarding.ts         # Onboarding state hook
│       │   └── usePetState.ts           # Pet state management hook
│       ├── styles/
│       │   ├── global.css               # Base styles, fonts
│       │   ├── egg-hatch.css            # Egg screen + hatch animation
│       │   ├── name-pet.css             # Naming screen styles
│       │   ├── pet-details.css          # Main care window styles
│       │   ├── pet-avatar.css           # Species/color/personality shapes
│       │   ├── overlay.css              # Overlay window styles
│       │   └── stat-bar.css             # Stat bar styles
│       └── assets/
│           └── pet/
│               ├── mochi/README.md
│               ├── blob/README.md
│               ├── bun/README.md
│               ├── sprout/README.md
│               ├── ghost/README.md
│               └── star/README.md
```

## Component Design

### App.tsx — Root Router

The root component reads onboarding state and renders the appropriate screen:

```typescript
// src/renderer/App.tsx
import { useOnboarding } from "./hooks/useOnboarding";
import { EggHatchScreen } from "./components/EggHatchScreen";
import { NamePetScreen } from "./components/NamePetScreen";
import { PetDetails } from "./components/PetDetails";

export function App() {
  const { state, petVariant, petState, transition } = useOnboarding();

  switch (state) {
    case "EGG_READY":
      return <EggHatchScreen onHatch={() => transition("HATCHING")} />;
    case "HATCHING":
      return <EggHatchScreen hatching onAnimationEnd={() => transition("NAMING")} />;
    case "NAMING":
      return <NamePetScreen variant={petVariant!} onNameSubmit={handleNameSubmit} />;
    case "ACTIVE_PET":
      return <PetDetails petState={petState!} onReset={handleReset} onRename={handleRename} />;
    default:
      return <EggHatchScreen onHatch={() => transition("HATCHING")} />;
  }
}
```

### EggHatchScreen Component

```typescript
// src/renderer/components/EggHatchScreen.tsx
interface EggHatchScreenProps {
  hatching?: boolean;
  onHatch: () => void;
  onAnimationEnd?: () => void;
}
```

Displays:
- App title "petmii"
- CSS egg placeholder (oval shape with gradient)
- "Hatch Egg" button (disabled during hatching)
- "Tap to meet your new pet." text
- When `hatching=true`: applies shake/crack animation class, calls `onAnimationEnd` after 2000ms

### NamePetScreen Component

```typescript
// src/renderer/components/NamePetScreen.tsx
interface NamePetScreenProps {
  variant: PetVariant;
  onNameSubmit: (name: string) => void;
}
```

Displays:
- Preview of the hatched pet using PetAvatar with variant CSS classes
- Text input (placeholder: "Name your pet", pre-filled with species default name)
- "Confirm" button
- Validation: non-empty, ≤20 chars, trims whitespace
- Error message display area

### PetDetails Component

```typescript
// src/renderer/components/PetDetails.tsx
interface PetDetailsProps {
  petState: PetState;
  onReset: () => void;
  onRename: (newName: string) => void;
  onFeed: () => void;
  onPlay: () => void;
  onClean: () => void;
  onRest: () => void;
}
```

Displays:
- Header: "petmii" title + pet name
- Species/color/personality label: "{species} · {color} · {personality}"
- PetAvatar (CSS placeholder with variant classes)
- Current mood indicator
- 5 stat bars (hunger, happiness, energy, cleanliness, bond)
- Action buttons: Feed, Play, Clean, Rest
- Message bubble with PetState.lastMessage
- Settings area: Rename button, Reset button

### PetAvatar Component

```typescript
// src/renderer/components/PetAvatar.tsx
interface PetAvatarProps {
  species: PetSpecies;
  color: PetColor;
  personality: PetPersonality;
  size?: "small" | "medium" | "large";
}
```

Renders a `<div>` with classes: `pet-avatar pet-species-{species} pet-color-{color} pet-personality-{personality}`.

## Persistence Layer

### Pet Storage (Main Process)

```typescript
// src/main/petStorage.ts
import { app } from "electron";
import path from "path";
import fs from "fs";

const STORAGE_PATH = path.join(app.getPath("userData"), "pet-state.json");

export function loadPetState(): PetState | null {
  // Read JSON file, validate required fields, return null if invalid/missing
}

export function savePetState(state: PetState): boolean {
  // Atomic write (write to temp file then rename)
}

export function clearPetState(): boolean {
  // Delete the storage file
}

export function validatePetState(data: unknown): data is PetState {
  // Check all required fields exist and have valid types/values
}
```

### IPC Channels

```typescript
// IPC channel definitions
const IPC_CHANNELS = {
  LOAD_PET: "pet:load",
  SAVE_PET: "pet:save",
  CLEAR_PET: "pet:clear",
  OPEN_OVERLAY: "window:open-overlay",
  CLOSE_OVERLAY: "window:close-overlay",
  UPDATE_OVERLAY: "window:update-overlay",
} as const;
```

### Preload Script

```typescript
// src/preload/preload.ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("petmiiAPI", {
  loadPet: () => ipcRenderer.invoke("pet:load"),
  savePet: (state: PetState) => ipcRenderer.invoke("pet:save", state),
  clearPet: () => ipcRenderer.invoke("pet:clear"),
  openOverlay: () => ipcRenderer.send("window:open-overlay"),
  closeOverlay: () => ipcRenderer.send("window:close-overlay"),
  updateOverlay: (variant: PetVariant) => ipcRenderer.send("window:update-overlay", variant),
});
```

## Random Pet Generator

```typescript
// src/renderer/pet/generateRandomPet.ts
import { PetSpecies, PetColor, PetPersonality, PetVariant } from "./petVariant";

const SPECIES: PetSpecies[] = ["mochi", "blob", "bun", "sprout", "ghost", "star"];
const COLORS: PetColor[] = ["cream", "pink", "blue", "mint", "lavender", "yellow"];
const PERSONALITIES: PetPersonality[] = ["sweet", "chaotic", "sleepy", "curious", "shy", "sassy"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRandomPetVariant(): PetVariant {
  return {
    species: randomFrom(SPECIES),
    color: randomFrom(COLORS),
    personality: randomFrom(PERSONALITIES),
  };
}
```

## CSS Placeholder System

### Species Shapes

Each species gets a distinct silhouette via border-radius and dimensions:

```css
/* src/renderer/styles/pet-avatar.css */
.pet-avatar {
  width: 80px;
  height: 80px;
  position: relative;
  transition: all 0.3s ease;
}

/* Round blob */
.pet-species-mochi { border-radius: 50%; }
/* Amorphous blob */
.pet-species-blob { border-radius: 60% 40% 50% 70% / 50% 60% 40% 50%; }
/* Rounded rectangle (bun shape) */
.pet-species-bun { border-radius: 50% 50% 40% 40%; }
/* Teardrop pointing up (sprout) */
.pet-species-sprout { border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; width: 60px; height: 90px; }
/* Ghost shape (rounded top, wavy bottom via clip-path) */
.pet-species-ghost { border-radius: 50% 50% 0 0; height: 100px; }
/* Star uses clip-path */
.pet-species-star { clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); }
```

### Color Classes

```css
.pet-color-cream { background-color: #FFF8E7; }
.pet-color-pink { background-color: #FFB5C8; }
.pet-color-blue { background-color: #A8D8EA; }
.pet-color-mint { background-color: #B5EAD7; }
.pet-color-lavender { background-color: #C9B1FF; }
.pet-color-yellow { background-color: #FFEAA7; }
```

### Personality Animations

```css
.pet-personality-sweet { animation: gentle-bounce 3s ease-in-out infinite; }
.pet-personality-chaotic { animation: shake-wobble 0.5s ease-in-out infinite; }
.pet-personality-sleepy { animation: slow-breathe 4s ease-in-out infinite; opacity: 0.85; }
.pet-personality-curious { animation: peek-around 3s ease-in-out infinite; }
.pet-personality-shy { animation: hide-peek 4s ease-in-out infinite; transform: scale(0.9); }
.pet-personality-sassy { animation: sway 2s ease-in-out infinite; }

@keyframes gentle-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

@keyframes shake-wobble {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-3deg); }
  75% { transform: rotate(3deg); }
}

@keyframes slow-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes peek-around {
  0%, 100% { transform: translateX(0); }
  30% { transform: translateX(5px); }
  70% { transform: translateX(-5px); }
}

@keyframes hide-peek {
  0%, 70%, 100% { transform: scale(0.9); opacity: 0.7; }
  80% { transform: scale(1); opacity: 1; }
}

@keyframes sway {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(5deg); }
}
```

### Hatch Animation

```css
/* src/renderer/styles/egg-hatch.css */
.egg {
  width: 70px;
  height: 90px;
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  background: linear-gradient(135deg, #FFF8E7, #FFE4B5);
  border: 3px solid #DEB887;
  position: relative;
}

.egg.hatching {
  animation: egg-crack 2s ease-in-out forwards;
}

@keyframes egg-crack {
  0% { transform: rotate(0deg) scale(1); }
  20% { transform: rotate(-3deg) scale(1); }
  40% { transform: rotate(3deg) scale(1.02); }
  60% { transform: rotate(-5deg) scale(1.05); }
  80% { transform: rotate(5deg) scale(1.1); opacity: 0.8; }
  100% { transform: rotate(0deg) scale(1.3); opacity: 0; }
}
```

## Window Management

### Main Process Window Manager

```typescript
// src/main/windowManager.ts
import { BrowserWindow } from "electron";

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    title: "petmii",
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.loadFile("src/renderer/index.html");
  return mainWindow;
}

export function createOverlayWindow(): BrowserWindow {
  overlayWindow = new BrowserWindow({
    width: 120,
    height: 120,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  overlayWindow.loadFile("src/renderer/overlay.html");
  return overlayWindow;
}

export function closeOverlayWindow(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
}
```

## React Hooks

### useOnboarding Hook

```typescript
// src/renderer/hooks/useOnboarding.ts
import { useState, useEffect } from "react";
import { AppOnboardingState, isValidTransition, transitionState } from "../pet/onboarding";
import { PetVariant, PetState } from "../pet/petVariant";

export function useOnboarding() {
  const [state, setState] = useState<AppOnboardingState>("EGG_READY");
  const [petVariant, setPetVariant] = useState<PetVariant | null>(null);
  const [petState, setPetState] = useState<PetState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // On mount: check storage
  useEffect(() => {
    async function init() {
      const saved = await window.petmiiAPI.loadPet();
      if (saved) {
        setPetState(saved);
        setState("ACTIVE_PET");
      } else {
        setState("EGG_READY");
      }
    }
    init();
  }, []);

  function transition(target: AppOnboardingState): boolean {
    if (!isValidTransition(state, target)) return false;
    setState(target);
    return true;
  }

  return { state, petVariant, petState, error, transition, setPetVariant, setPetState, setError };
}
```

### usePetState Hook

```typescript
// src/renderer/hooks/usePetState.ts
import { PetState } from "../pet/petVariant";

export function usePetState(petState: PetState | null) {
  async function feed() { /* update hunger, persist */ }
  async function play() { /* update happiness, persist */ }
  async function clean() { /* update cleanliness, persist */ }
  async function rest() { /* update energy, persist */ }
  async function rename(newName: string) { /* validate, update name, persist */ }
  async function reset() { /* clear storage, return null */ }

  return { feed, play, clean, rest, rename, reset };
}
```

## Overlay Communication

The overlay window receives pet variant data via IPC:

1. When `ACTIVE_PET` state is reached, renderer sends `window:open-overlay` via IPC
2. Main process creates overlay window, passing the pet variant
3. Overlay renders `OverlayApp.tsx` which displays `PetAvatar` with the variant classes
4. On pet reset, renderer sends `window:close-overlay` via IPC
5. Main process destroys overlay window

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Desktop Framework | Electron |
| Language | TypeScript |
| UI Framework | React 18 |
| Styling | CSS Modules / plain CSS |
| Build Tool | Vite (with electron-vite or similar) |
| Persistence | JSON file in app userData directory |
| Package Manager | npm |
| Testing | Vitest (unit), Playwright (e2e, future) |

## Security Considerations

- `contextIsolation: true` — renderer cannot access Node.js APIs directly
- `nodeIntegration: false` — prevents arbitrary Node access from renderer
- All storage operations go through IPC invoke/send via the preload bridge
- Input validation in both renderer (UI feedback) and main process (persistence guard)
- Atomic file writes prevent corrupted storage on crash

## Error Handling Strategy

| Scenario | Behavior |
|----------|----------|
| Storage file missing | Treat as no pet, show EGG_READY |
| Storage file corrupted/invalid JSON | Treat as no pet, show EGG_READY |
| Storage file has missing fields | Treat as no pet, show EGG_READY |
| Save fails (disk full, permissions) | Show error message, keep current state, allow retry |
| Random generation failure | Retry up to 3 times, then show error on egg screen |
| Invalid state transition attempted | Reject silently, remain in current state |

## Correctness Properties

### Property 1: State Machine Integrity

The App_Onboarding_State shall hold exactly one value at all times and only transition via the defined valid transitions (EGG_READY→HATCHING→NAMING→ACTIVE_PET, ACTIVE_PET→EGG_READY). Invalid transitions are rejected and the state remains unchanged.

**Validates: Requirements 13.1, 13.7, 13.8**

### Property 2: Storage Consistency

PetState in Pet_Storage shall always be either null/absent or a fully valid object with all required fields. Partial writes are prevented by atomic file operations (write to temp file, then rename).

**Validates: Requirements 6.4, 9.1, 9.3**

### Property 3: Idempotent Initialization

Calling `loadPet()` multiple times returns the same result. The init sequence is safe to re-run without side effects.

**Validates: Requirements 9.1, 9.2**

### Property 4: Name Validation Invariant

PetState.name is always non-empty, trimmed, and ≤20 characters after any create or rename operation. This is enforced at both the UI layer (preventing submission) and the persistence layer (validation before write).

**Validates: Requirements 5.3, 5.4, 5.5, 11.1, 11.2**

### Property 5: Overlay Lifecycle

The overlay window exists if and only if App_Onboarding_State is ACTIVE_PET. No dangling overlay windows are permitted. When state transitions away from ACTIVE_PET, the overlay is closed. When state transitions to ACTIVE_PET, the overlay is opened.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

### Property 6: CSS Class Correctness

The pet avatar element always has exactly three variant classes applied simultaneously (one species, one color, one personality). No partial or duplicate class application is permitted.

**Validates: Requirements 12.5, 12.6**

## Error Handling

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Storage file missing on load | `fs.existsSync` returns false | Return null, app shows EGG_READY |
| Storage file corrupted JSON | `JSON.parse` throws | Delete file, return null, show EGG_READY |
| Storage file has missing/invalid fields | `validatePetState` returns false | Return null, show EGG_READY |
| Save fails (disk full, permissions) | `fs.writeFileSync` throws | Return false to renderer, show error toast, allow retry |
| Clear fails | `fs.unlinkSync` throws | Log error, attempt again, show error if persistent |
| Random generation produces undefined | Array access returns undefined | Retry up to 3 times (should never happen with correct arrays) |
| Invalid state transition | `isValidTransition` returns false | Reject transition, remain in current state, log warning |
| IPC timeout | Promise doesn't resolve within 5s | Reject with timeout error, show user-facing message |
| Overlay window creation fails | `BrowserWindow` constructor throws | Log error, continue without overlay (non-critical) |

## Testing Strategy

### Unit Tests (Vitest)

| Module | Test Focus |
|--------|-----------|
| generateRandomPet.ts | Returns valid PetVariant, uniform distribution over many runs, never returns undefined |
| onboarding.ts | Valid transitions succeed, invalid transitions rejected, all states reachable |
| petVariant.ts | Type guard validation for PetState fields |
| petStorage.ts | Load/save/clear operations, handles missing file, handles corrupted JSON, atomic write |
| Name validation logic | Empty rejected, whitespace-only rejected, >20 chars rejected, valid names trimmed |

### Component Tests (Vitest + React Testing Library)

| Component | Test Focus |
|-----------|-----------|
| EggHatchScreen | Renders egg, button, text; button click calls onHatch; disabled during hatching |
| NamePetScreen | Pre-fills species name; validates empty/long input; calls onNameSubmit with trimmed name |
| PetDetails | Renders all stat bars, pet name, variant label, action buttons |
| PetAvatar | Applies correct CSS classes for given variant |
| RenamePetModal | Pre-fills current name, validates, calls onRename |

### Integration Tests (Vitest)

| Flow | Test Focus |
|------|-----------|
| Full onboarding | EGG_READY → HATCHING → NAMING → ACTIVE_PET with storage verification |
| Reset flow | ACTIVE_PET → EGG_READY with storage cleared |
| App restart | Load existing PetState, skip to ACTIVE_PET |
| Corrupted storage | App gracefully falls back to EGG_READY |

### E2E Tests (Playwright — future)

| Scenario | Coverage |
|----------|----------|
| First launch onboarding | Full visual flow from egg to main care |
| Overlay appears after hatch | Verify overlay window opens with correct pet |
| Reset and re-hatch | Full cycle reset + new pet |

## Traceability

| Requirement | Components |
|-------------|-----------|
| Req 1: App Naming | package.json, README.md, windowManager.ts (title), App.tsx (header) |
| Req 2: Egg Screen | EggHatchScreen.tsx, egg-hatch.css |
| Req 3: Random Generation | generateRandomPet.ts |
| Req 4: Hatch Animation | EggHatchScreen.tsx, egg-hatch.css (@keyframes egg-crack) |
| Req 5: Pet Naming | NamePetScreen.tsx, name-pet.css |
| Req 6: State Creation | useOnboarding.ts, petStorage.ts |
| Req 7: Main Care Window | PetDetails.tsx, pet-details.css, StatBar.tsx |
| Req 8: Overlay Window | OverlayApp.tsx, windowManager.ts, overlay.css |
| Req 9: Persistence | petStorage.ts, ipcHandlers.ts, useOnboarding.ts (init) |
| Req 10: Pet Reset | PetDetails.tsx (reset button), usePetState.ts, petStorage.ts |
| Req 11: Pet Renaming | RenamePetModal.tsx, usePetState.ts |
| Req 12: Placeholder Visuals | PetAvatar.tsx, pet-avatar.css |
| Req 13: Onboarding State | onboarding.ts, useOnboarding.ts, App.tsx |
| Req 14: File Structure | Entire src/ directory layout, assets/pet/ folders |
