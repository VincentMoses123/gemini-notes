# Gemini Notes — Official Product Website

This directory (`website/`) contains the static product showcase and documentation website for **Gemini Notes** — the local-first macOS note-taking application with an inline Gemini AI writing assistant and native Apple Silicon (`arm64` / Universal) support.

---

## Folder Structure

```text
website/
├── index.html          # Main landing page (Hero, Features, Interactive Demo, Architecture, Download)
├── style.css           # Apple Notes dark/light design system & responsive layout styles
├── app.js              # Interactive AI demo widget, 5-theme studio previewer, and FAQ accordion
├── assets/
│   └── app-icon.png    # Official Gemini Notes application icon
└── README.md           # Local preview & hosting guide
```

---

## Local Preview

The website is built with zero-build static HTML, CSS, and vanilla JavaScript, so it can be previewed immediately using any of the methods below:

### Option 1: Using the npm script (Recommended)
From the repository root (`gemini-notes/`), run:
```bash
npm run preview:website
```
Then open **[http://localhost:4173](http://localhost:4173)** in your browser.

### Option 2: Using Python's built-in HTTP server
```bash
python3 -m http.server 4173 --directory website
```

### Option 3: Direct Browser Open
Double-click `website/index.html` in Finder or run:
```bash
open website/index.html
```

---

## Hosting & Deployment

Because `website/` is a self-contained static site with relative asset paths (`./style.css`, `./app.js`, `./assets/app-icon.png`), it can be deployed directly to any static hosting provider with zero build step required:

### 1. GitHub Pages
1. Push the repository to GitHub.
2. Go to **Settings → Pages** in your GitHub repository.
3. Under **Build and deployment**, select **GitHub Actions** or deploy from branch and set the root folder to `/website` (or publish the `website/` directory via `actions/upload-pages-artifact`).

### 2. Vercel
1. Import the repository into [Vercel](https://vercel.com) or run `npx vercel website`.
2. Set **Framework Preset** to `Other` and **Root Directory** to `website`.
3. Leave **Build Command** empty and **Output Directory** as `.`.

### 3. Netlify
1. Drag and drop the `website/` folder into [Netlify Drop](https://app.netlify.com/drop), or connect your Git repository.
2. Set **Base directory** / **Publish directory** to `website` with no build command needed.
