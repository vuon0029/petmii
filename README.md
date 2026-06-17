# petmii 🐾

A desktop virtual pet companion that lives on your screen. Hatch a randomized pet, care for it, and watch it hop around your taskbar in overlay mode.

## Features

**Pet Care**
- Hatch a random pet from 6 species (mochi, blob, bun, sprout, ghost, star) × 6 colors × 6 personalities
- Name your pet (up to 20 characters)
- Feed, play, clean, and rest to maintain stats (hunger, happiness, energy, cleanliness, bond)
- Mood system that reflects your pet's current state
- Rename or reset your pet at any time

**Overlay Mode**
- Minimize the main window to release your pet onto the desktop
- Pet sits on top of the taskbar and hops around the screen with bunny-hop animations
- Transparent window — only the pet sprite is visible, no background blocking your work
- Minecraft-style nametag appears on hover
- Low stat alerts float above the pet when it needs attention
- Click the pet to return to the main window

**Physics Interactions**
- Click and hold to pick up and drag the pet
- Throw the pet — velocity and direction are calculated from your mouse movement
- Pet spins in the air based on throw speed
- Bounces off walls, ceiling, and floor with realistic damping
- Lands at a rotated angle after a strong throw, then wobbles back upright
- Gravity pulls the pet back to the taskbar after being dropped

**Sprite Animation**
- 48×48px sprite sheets with 4-frame walk animations
- Per-species, per-color sprite variants (144 total combinations supported)
- CSS fallback shapes when sprites aren't available
- Pixel-art rendering with `image-rendering: pixelated`

**Resource Monitor**
- Built-in system resource monitor showing per-process CPU and RAM usage
- Displays Electron process breakdown (main, renderer, GPU)
- Toggle on/off from the main pet details view

## Tech Stack

- **Electron** — Desktop app framework (v28)
- **React 18** — UI rendering
- **TypeScript** — Type safety throughout
- **Vite** — Bundling and dev server (via electron-vite)
- **Vitest** — Unit testing
- **electron-builder** — App packaging and distribution

## Project Structure

```
src/
├── main/              # Electron main process
│   ├── main.ts        # App entry, lifecycle
│   ├── windowManager.ts  # Window creation, overlay physics, hop animation
│   ├── ipcHandlers.ts    # IPC bridge between main and renderer
│   └── petStorage.ts     # JSON file persistence with validation
├── preload/           # Context bridge (petmiiAPI)
│   └── preload.ts
└── renderer/          # React UI
    ├── App.tsx        # Main app with onboarding state machine
    ├── OverlayApp.tsx # Overlay mode (pet on taskbar)
    ├── components/    # React components
    ├── hooks/         # Custom hooks (usePetState, useOnboarding)
    ├── pet/           # Pet types, generation, onboarding logic
    ├── styles/        # CSS modules
    └── assets/pet/    # Sprite sheets organized by species/color
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

If you're making changes and the app shows stale content, use the clean dev command:

```bash
npm run dev:clean
```

This clears the build cache and rebuilds before starting.

### Build

```bash
npm run build
```

### Test

```bash
npm run test
```

### Package

```bash
npm run package
```

## Adding Pet Sprites

Sprites are organized at `src/renderer/assets/pet/{species}/{color}/{mood}.png`.

Each sprite sheet should be:
- A horizontal strip of **4 frames** at **48×48px** per frame (192×48px total)
- PNG with transparent background
- Named by mood: `idle.png`, `happy.png`, `sad.png`, `sleep.png`

After adding sprites, register them in `src/renderer/assets/pet/spriteRegistry.ts` with static imports.

The app falls back to CSS-generated shapes for any species/color combination that doesn't have sprites.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run dev:clean` | Clear cache, rebuild, then start dev |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests (single run) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run package` | Package app for distribution |

## License

MIT
