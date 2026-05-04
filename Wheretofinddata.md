Great question. Here are the best sources depending on how you want to pull the data:

---

## Primary Data Sources

### 1. VGChartz
- **What it has:** Game sales by platform, region (NA/EU/JP/Global), release date, publisher
- **How to get it:** Web scraping — there's no official API, but it's the most comprehensive sales database publicly available
- **Claude/code approach:** Use Python + BeautifulSoup or Scrapy to scrape their search filtered to Square/Enix/Square Enix as publisher

### 2. IGDB (Internet Game Database)
- **What it has:** Game metadata — genres, platforms, release dates, developer, publisher, cover art, ratings
- **How to get it:** **Free official API** — this is your cleanest option for metadata
- **Claude/code approach:** Hit the API directly, filter by company ID for Squaresoft, Enix, and Square Enix
- **Link:** igdb.com/api

### 3. Metacritic / OpenCritic
- **What it has:** Critic scores and user scores
- **How to get it:** OpenCritic has a **free API** — much easier than scraping Metacritic
- **Link:** api.opencritic.com

### 4. Kaggle Datasets
- **What it has:** Pre-built, cleaned datasets — there are several Video Game Sales datasets already on Kaggle that cover VGChartz data
- **How to get it:** Direct CSV download, no scraping needed
- **Best for:** Getting started quickly before you build a custom scraper
- **Search:** "video game sales kaggle" or "square enix games dataset kaggle"

### 5. Wikipedia
- **What it has:** Lists of games by Squaresoft, Enix, and Square Enix with release years, platforms, and series info
- **How to get it:** Wikipedia has a free API, or you can scrape the tables directly
- **Best for:** The pre-merger Squaresoft and Enix catalogs specifically, which are well documented in list articles

---

## Recommended Approach with Claude Code

The cleanest workflow would be:

1. **Start with a Kaggle VGChartz CSV** as your base — this gets you sales + platform data immediately without any scraping
2. **Enrich with IGDB API** — join on game title to pull in genre, developer, and detailed platform info
3. **Add OpenCritic scores** — join on title for critic/user scores
4. **Fill gaps manually** for obscure pre-merger titles that might not appear in automated pulls
5. **Use Claude Code to write the cleaning/merging scripts** in Python with Pandas — you can literally describe your schema and have it write the ETL pipeline for you

---

## Columns You'd End Up With After Merging

```
title | company_era | developer | genre | subgenre | 
dimension (2D/3D) | platform | platform_family | 
platform_type | release_year | region | sales | 
critic_score | user_score | exclusive_status | 
nintendo_relationship_era | series | japan_only
```

