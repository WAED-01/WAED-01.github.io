# WAED.exe — Interactive Arcade Portfolio (Dynamic Edition)

An interactive, heavily-animated portfolio for **Waed Hazem Ahmad** with a neon
arcade / RPG theme — now supercharged with scroll-driven motion: parallax layers,
elements that appear and slide in as you scroll, a growing timeline, a perspective
grid floor, scroll-spy navigation, and a 3D character with 10 playable animations.

## Run locally
The 3D model and JS modules need a local server (opening index.html directly won't work):

```bash
# from inside this folder
python -m http.server 8000
# open http://localhost:8000
```
or: `npx serve .`

## Deploy
Any static host: GitHub Pages, Netlify, Vercel, Cloudflare Pages.
Upload the whole folder, keeping `assets/` next to index.html.
The character (`assets/chibi.glb`) is only ~4.7 MB, so it loads fast.

## The 3D character
Your uploaded character came as 10 separate 30 MB files (297 MB total). I merged all
ten animations into a single optimized **4.7 MB** GLB (one shared mesh + skin, texture
recompressed from a 4K PNG to a 2K JPEG). The emote bar under the character plays:
👋 Wave · 💖 Heart · 👍 Agree · ⭐ Jump · 🙌 Hop · 🕺 Dance · 🚶‍♀️ Walk · 🏃‍♀️ Run.
She also idles with two alternating poses for liveliness, and renders with corrected
materials + lighting (no more white blowout).

## What makes it dynamic
- **Scroll parallax** — the character and text drift and fade as you leave the hero
- **Perspective grid floor** that scrolls toward you
- **Reveal-on-scroll** — skills, quests, achievements and timeline cards fade/slide in
  (alternating left/right), staggered so they cascade
- **Growing timeline** — the adventure-log spine fills as you scroll through it; nodes light up
- **Scroll-spy dots** (right edge) + a **ZONE x / 6** level pill that tracks your position
- **XP bar** across the top fills with scroll progress
- **Glitch** effect on the "Select Your Engineer" heading when it enters view
- **3D tilt** on the profile and quest cards as you move the mouse
- Floating tech icons with mouse parallax, twinkling starfield, animated summon ring

## Hidden stuff
- Drag the character to rotate; scroll over her to zoom
- Scroll to the very bottom → "Completionist" achievement
- Konami code ↑↑↓↓←→←→BA → dance party

## Customize
- LinkedIn: replace `https://www.linkedin.com` in index.html with your profile URL
- Colors/fonts: edit `:root` at the top of style.css
- Skills, typed roles: edit the `skills` and `roles` arrays in main.js
- Swap the character: replace `assets/chibi.glb` (animation names must match the emote
  buttons' `data-anim` values, or update those in index.html + the IDLES/ONE_SHOT sets in main.js)
```
