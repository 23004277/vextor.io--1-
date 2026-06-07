# vextor.io

This is a web-based game project built with React, TypeScript, and Vite.

## Local Development in VS Code

To run this project locally in VS Code:

1. **Prerequisites:**
   - Ensure you have [Node.js](https://nodejs.org/) installed (LTS version recommended).

2. **Setup:**
   - Open the project folder in VS Code.
   - Open the integrated terminal (Ctrl+` or Cmd+`).
   - Install dependencies:
     ```bash
     npm install
     ```

3. **Running the Development Server:**
   - Start the development server:
     ```bash
     npm run dev
     ```
   - Open the URL provided in the terminal (usually `http://localhost:3000`) in your browser.

4. **Recommended Extensions:**
   - The project includes recommended VS Code extensions for a better development experience. VS Code should prompt you to install them upon opening the project.

## Useful Commands

- Install dependencies:

```bash
npm install
```

- Start development server:

```bash
npm run dev
```

- TypeScript check (lint):

```bash
npm run lint
```

- Build for production:

```bash
npm run build
```

## Recent Changes (dev notes)

- Increased common-shape spawn rate but added `commonShapeCooldown` and `commonShapeMaxActive` to limit active commons and avoid map crowding.
- Visual redesign for common `SQUARE`, `TRIANGLE`, and `PENTAGON` moved to a dedicated `drawCommonVisuals()` routine in `services/GameEngine.ts`.
- AI improvements across `systems/FFAAIStrategy.ts` and `systems/TDM-ai.ts` (better bullet avoidance, panic behavior, and stuck recovery).
- Background music now supports a 3.75s entry break and a 5s end-of-track break for better UX in menus.
- Progression tuning: `REBIRTH_LEVEL` and `MAX_LEVEL` updated; high-level XP gains improved for elite/boss kills.
