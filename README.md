# Reparodynamics Corpus (Static Index)

**Live site:** https://bonemantgrm.github.io/reparodynamics-corpus/  
This repo hosts a free static website that lists all Zenodo records by **Cody Ryan Jenkins**.  
Update the list by editing `corpus.json`. The site redeploys automatically via GitHub Pages.

---

## 📘 How to Update

1. **Edit** `corpus.json` in GitHub (add new objects to the array).
2. **Keep the schema** exactly as below (keys and types).
3. **Commit** — GitHub Actions rebuilds and deploys in ~30s.

---

## 🧩 JSON Schema

Each record in `corpus.json` must follow this format:

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
  "abstract": "Short 50–100 word summary of the paper."
}
