# Cube Catcher

A minimalist endless arcade game built with **Python** and **Pygame**. Move the catcher, match the colors, survive as long as you can.

## Gameplay

Colored cubes fall endlessly from the top of the screen. You control a catcher at the bottom that starts with a random color. Catch a cube **only if its color matches your catcher's color** — a successful catch scores a point and instantly gives your catcher a new random color. Catch the wrong color, and it's game over.

No levels, no upgrades, no timers — just pure reflex-based endless gameplay.

## Controls

| Key | Action |
|-----|--------|
| `A` | Move left |
| `D` | Move right |

## Rules

- ✅ Cube color matches catcher color → cube removed, score +1, catcher gets a new random color
- ❌ Cube color does not match → game over
- Cubes spawn at random intervals (0.5–1.0s) and random horizontal positions
- Score is displayed at the top center of the screen

## Installation

Requires Python 3 and Pygame.

```bash
python -m pip install pygame
```

## Run

```bash
python CubeCatcher.py
```

## Tech Stack

- Python 3
- Pygame
- Object-oriented design (`Player` and `Cube` classes)
- Delta-time based movement for smooth, frame-rate independent gameplay

## Project Structure

Single-file implementation — everything lives in `CubeCatcher.py`, no external assets or dependencies beyond Pygame.

## License

MIT
