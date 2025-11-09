# Reparodynamics Corpus (Static Index)

A free static site indexing **all Zenodo records** by **Cody Ryan Jenkins**.

## How to update
1. Edit `corpus.json` directly in GitHub.
2. Add new paper entries in the same format.
3. Commit changes — the site updates automatically.

### Schema
```json
{
  "title": "Paper title",
  "doi": "10.5281/zenodo.xxxxxxxx",
  "url": "https://doi.org/10.5281/zenodo.xxxxxxxx",
  "date": "YYYY-MM-DD",
  "views": 0,
  "downloads": 0,
  "topic": "Core Theory",
  "tags": ["Reparodynamics","TGRM","RYE"],
  "abstract": "Short 50–100 word summary..."
}
---

### 6️⃣ Create folder `.github/workflows/`
and inside it make one file named:

#### `.github/workflows/pages.yml`
```yaml
name: Deploy corpus to GitHub Pages
on:
  push:
    branches: [ main ]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - uses: actions/deploy-pages@v4
