# Anush Lobo — Portfolio

A keyboard-controlled Three.js walking-game portfolio. Guide a cartoon adventurer along a gently curved 3D road, visit alternating houses, and open resume sections in overlays. A third-person camera follows from behind and above the character; the document itself does not scroll.

The road loops continuously in both directions. After Contact, the next house is About again. Houses are spaced roughly 3.4 seconds of walking apart; the distance indicator shows your position within the current loop. Neighboring houses remain visible together as you travel, with smoothly blended camera focus instead of replacing one house with the next.

The surroundings use a repeatable seed: mixed roadside trees, bushes, short timber fences, meadow grass, wildflowers, pebbles, and two ponds with reeds and lily pads. The scenery loops with the houses and reserves clear space around the road, house plots, signs, and door approaches. Static details are batched, and distant houses use lighter models.

## Technology

- **Three.js** for the 3D scene, primitive character and house models, shadows, fog, and curved-world shader.
- **HTML and CSS** for the responsive game interface and resume panels.
- **Vanilla JavaScript** for keyboard input, world movement, camera tracking, proximity prompts, and resume overlays.

The game runs entirely in the browser and is hosted as static files. There are no packages to install, build commands, environment variables, databases, or backend services to configure. Python is used only to serve the files during local development.

## Run locally

### Requirements

- A modern browser, such as Chrome, Firefox, Edge, or Safari.
- WebGL 2 support and an internet connection to load the pinned Three.js modules from jsDelivr.
- A keyboard to play the game.
- [Python 3](https://www.python.org/downloads/) for the local preview server.

### 1. Open the project folder

Download or clone the project, then open a terminal in the folder containing `index.html`, `styles.css`, `scene.js`, `scenery.js`, `resume-data.js`, and `script.js`. If the folder is named `portfolio`, you can enter it with:

```bash
cd portfolio
```

### 2. Start the preview server

On Linux or macOS:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

On Windows, with the Python launcher installed:

```powershell
py -3 -m http.server 8000 --bind 127.0.0.1
```

Keep this terminal open while using the website.

### 3. Open the website

Visit **http://127.0.0.1:8000/** in your browser.

Edit the source files and refresh the browser to see your changes. Stop the server with **Ctrl+C** in the terminal.

Serve the folder over HTTP using the command above; the 3D scene uses ES modules that cannot reliably load by opening `index.html` as a local file.

## Game controls

| Key | Action |
| --- | --- |
| Hold **↑** or **W** | Walk forward. |
| Hold **↓** or **S** | Walk backward. |
| **←** near a left-side house | Enter that resume section. |
| **→** near a right-side house | Enter that resume section. |
| **Esc** or the opposite arrow | Close the section and return to the same place on the road. |

An entry prompt appears when you are close enough to a house. Walking pauses while an overlay is open. Long section content scrolls inside the overlay, and the **×** button also closes it.

## Project files

```text
portfolio/
├── index.html      # Canvas, pinned import map, and overlay shell
├── styles.css      # Responsive game interface and resume panel styles
├── scene.js        # Three.js renderer, world shader, models, and camera
├── scenery.js      # Seeded roadside layout, clearances, and instanced scenery
├── resume-data.js  # Content for all six resume sections
├── script.js       # Keyboard controls, camera, houses, and overlays
├── README.md       # Local setup and usage instructions
└── DEPLOYMENT.md   # Free hosting instructions
```

## Customize the portfolio

- Update your biography, skills, projects, experience, education, and contact links in `resume-data.js`.
- Update house labels, sides, colors, and spacing in `HOUSE_STOPS` in `script.js`. Each stop's `id` must match a key in `RESUME_SECTIONS` in `resume-data.js`.
- Adjust movement speed, house spacing, camera response, and entry distance in `CONFIG` in `script.js`. The loop length is calculated automatically from the number of houses and their spacing.
- Change 3D colors, camera settings, lighting palette, fog distances, and world curvature in `SCENE_CONFIG` at the top of `scene.js`.
- Adjust `SCENE_CONFIG.scenery` to change the scenery seed, prop counts, ponds, and meadow colors. `camera.focusHeight` controls the lower camera aim.
- Change colors and font variables in the `:root` block at the top of `styles.css`.
- Update the displayed name, page title, and meta description in `index.html`.

The contact buttons use `mailto:` and `tel:` links. Email links open the visitor's configured email application.

## Troubleshooting

| Issue | Solution |
| --- | --- |
| Python command is not found | Install Python 3. If your installation uses `python` instead of `python3`, confirm `python --version` reports Python 3 and use `python -m http.server 8000 --bind 127.0.0.1`. |
| Port 8000 is already in use | Replace `8000` with `8001` in the server command, then visit `http://127.0.0.1:8001/`. |
| A directory listing appears instead of the portfolio | Stop the server and start it from the folder containing `index.html`. |
| Changes do not appear | Save the edited file and hard-refresh the browser with Ctrl+Shift+R, or Cmd+Shift+R on macOS. |
| The character does not move | Click the game to focus the browser page, close any open section, then hold ↑/W or ↓/S. |
| A house does not open | Move closer until its prompt appears, then press the arrow pointing toward that house. |
| Resume content does not load | Confirm `resume-data.js` is beside `index.html` and its script tag appears before `script.js`. |
| The 3D world does not load | Use the HTTP preview URL, confirm the browser supports WebGL 2, and check that your connection can reach `cdn.jsdelivr.net`. |
| Opening `index.html` shows preview-server instructions | The browser opened a `file://` URL, which blocks local ES modules. Start the preview server from the portfolio folder, then use `http://127.0.0.1:8000/` or click **Open the 3D portfolio**. |

## Deploy for free

See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step GitHub Pages setup, your public website URL, and instructions for publishing updates.
