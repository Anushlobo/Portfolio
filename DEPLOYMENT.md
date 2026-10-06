# Deploy the portfolio for free

Use **GitHub Pages** to host this browser-based walking game for free. All game logic runs in the browser, so static hosting is sufficient. With a GitHub Free account, the repository must be **public**. GitHub provides a free `github.io` address and HTTPS, so you do not need to purchase a domain.

This guide uses the GitHub website; you can complete it without installing Git or using terminal commands.

## What you need

- A [GitHub account](https://github.com/signup).
- The portfolio files on your computer.
- A working local preview. Follow [README.md](README.md#run-locally) to check the site first.

## 1. Create a public repository

1. Sign in to GitHub and open [Create a new repository](https://github.com/new).
2. Set the repository name to `portfolio`.
3. Choose **Public** to use GitHub Pages on the free plan.
4. Leave **Add README** disabled, since this project already includes one.
5. Click **Create repository**.

If you already have a public repository for this portfolio, use that repository for the remaining steps.

## 2. Upload the website files

1. In the new repository's quick-setup section, click **uploading an existing file**. For an existing repository, use **Add file → Upload files**.
2. Upload these files directly into the repository's top level:

   ```text
   index.html
   styles.css
   scene.js
   scenery.js
   resume-data.js
   script.js
   README.md
   DEPLOYMENT.md
   ```

3. Enter a commit message, such as `Add portfolio website`, and click **Commit changes**. If asked where to commit, choose the default branch, usually `main`.

The repository should show `index.html` immediately when you open its **Code** tab. Upload the files themselves so the layout is:

```text
repository root/
├── index.html
├── styles.css
├── scene.js
├── scenery.js
├── resume-data.js
├── script.js
├── README.md
└── DEPLOYMENT.md
```

`index.html`, `styles.css`, `scene.js`, `scenery.js`, `resume-data.js`, and `script.js` are the files needed to run the game. Keep them together in the same folder. The import map in `index.html` loads a pinned version of Three.js from jsDelivr; visitors need an internet connection and WebGL 2 support.

## 3. Enable GitHub Pages

1. Open the repository's **Settings** tab.
2. Select **Pages** in the left sidebar.
3. Under **Build and deployment**, set:

   | Setting | Value |
   |   ---   |  ---  |
   | Source | **Deploy from a branch** |
   | Branch | **main**, or the branch containing the uploaded files |
   | Folder | **/(root)** |

4. Click **Save**.
5. Wait for the initial deployment. Publishing can take up to **10 minutes**.
6. Open the **Actions** tab to check the Pages build/deployment status. Once it succeeds, return to **Settings → Pages** and click **Visit site**.

The site files are ready to publish as they are. No application build command, package installation, or environment-variable setup is needed.

## 4. Find your public URL

For a repository named `portfolio`, your website address is:

```text
https://YOUR-USERNAME.github.io/portfolio/
```

Replace `YOUR-USERNAME` with your GitHub username. For example, if the repository belongs to `Anushlobo`, the address would be:

```text
https://anushlobo.github.io/portfolio/
```

To publish at `https://YOUR-USERNAME.github.io/` instead, name the repository `your-username.github.io` when creating it, using your username in lowercase, and follow the same steps above.

Use the supplied `github.io` URL for free hosting. In **Settings → Pages**, ensure **Enforce HTTPS** is enabled if the option is available.

## 5. Check the live website

- Confirm the full-screen road and character load with their styling.
- Hold **↑/W** and **↓/S** to check walking and camera following.
- On a phone, hold the **Front** and **Back** touch buttons and tap the directional house prompt to enter a section.
- Visit each house, wait for its prompt, and press the arrow toward it to enter.
- Close sections using **Esc**, the opposite arrow, and the **×** button.
- Check narrow-screen layouts with your browser's responsive preview.
- Enter the Contact house and check the email, phone, GitHub, and LinkedIn links.

The existing stylesheet and JavaScript references are relative paths, so they work when the game is served under `/portfolio/`.

## Publish future updates

1. Edit the files locally and preview the site using the instructions in [README.md](README.md#run-locally).
2. In the GitHub repository, select **Add file → Upload files** and upload the changed files using the same names and locations. You can also edit a file directly using GitHub's pencil icon.
3. Commit the changes to the branch selected in **Settings → Pages**. If you create a pull request, merge it into that branch to publish the update.
4. GitHub Pages automatically deploys the update. Check the **Actions** tab for completion, then refresh the live site.

## Troubleshooting

| Issue | What to check |
| --- | --- |
| The site shows a 404 | Confirm the Pages deployment succeeded, the selected branch contains `index.html` at its root, and the URL includes `/portfolio/` for a repository named `portfolio`. Allow up to 10 minutes after publishing. |
| `main` is missing from the branch selector | Upload and commit the files first, then reopen **Settings → Pages**. Select the actual branch name if it is different. |
| The game loads without styling, controls, or resume overlays | Confirm `styles.css`, `scene.js`, `scenery.js`, `resume-data.js`, and `script.js` are beside `index.html` and the names match exactly, including capitalization. |
| The 3D loading message reports an error | Check WebGL 2 support and access to `cdn.jsdelivr.net`, then inspect the browser console for a module-loading or shader error. |
| GitHub displays the README instead of the portfolio | Make sure you opened the `github.io` website URL, rather than the `github.com` repository URL. |
| Changes are missing | Confirm the latest changes are on the configured publishing branch and its Pages deployment succeeded, then hard-refresh the browser. |
| Deployment fails | Open the failed run in **Actions** and inspect its error message. Recheck the publishing branch and **/(root)** folder selection. |

## Official documentation

- [Create a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Configure the publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Troubleshoot GitHub Pages 404 errors](https://docs.github.com/en/pages/getting-started-with-github-pages/troubleshooting-404-errors-for-github-pages-sites)
