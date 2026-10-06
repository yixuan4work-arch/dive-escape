# Dive Escape

*Escape from CT Hub… to go diving.* A static web app that plans dive trips around Singapore's public holidays. It tells you:

- **When to go, and how much leave to take:** every public holiday in the next 12 months, with the longest break you can get for 0 to 5 leave days. Set how many leave days you can spare, and it picks the set of breaks that gives you the most days off.
- **Go or not:** a verdict for the Malaysian dive islands you can drive to over the Causeway (Tioman, Pulau Aur & Dayang, Redang, the Perhentians). It checks whether the islands are in season, since they close for the northeast monsoon from roughly November to February. Then it checks the rain: the 16-day forecast when your trip is close enough, otherwise the same dates last year.
- **Where to dive this month:** for any month, the best sites across Malaysia, Thailand, Indonesia, the Philippines and Australia. Each one shows the animals, season, trip length and how to get there, plus the cheapest break that fits it and how many leave days that costs.
- **Driving up today?:** live LTA cameras at Woodlands and Tuas, plus this weekend's rain forecast at the dive islands.

## Run it

It's a static site. The browser calls the open APIs directly, and there are no keys or build step.

**Online:** it's hosted on GitHub Pages. Every push to `main` redeploys it through `.github/workflows/pages.yml`.

**Locally:** you need [Node.js](https://nodejs.org) 18 or newer. There's nothing to install.

```
cd johor-escape
npm start
```

Then open http://localhost:3000. To use another port: `PORT=3001 npm start` (on PowerShell: `$env:PORT=3001; npm start`). Edit anything in `public/` and refresh the browser.

## Why it exists (product thinking)

We worked this out with the Five Whys and wrote it up with the 4Cs from IDG's [Product Thinking](https://www.idg.gov.sg/product-thinking/) guides.

- **Clarity:** Divers who work in Singapore miss chances to dive, or plan trips badly.
- **Consequence:** They notice long weekends too late, use more leave than they need to, or book a trip that turns out to be rained out or closed for the monsoon. They also miss seasonal encounters, such as hammerheads at Layang-Layang or mola mola in Bali, because they didn't know the season.
- **Cause:** The information they need is scattered: the holiday calendar, their own leave maths, dive seasons for each country, the weather, and the Causeway traffic. Nothing joins it into one decision.
- **Confirmation:** This is still an assumption from our interview. Test it by asking divers how they planned their last trip.

The app helps people make one decision: **where to dive, when, and how many leave days to take.**

## Data sources

| Feed | Used for | Refreshed |
|---|---|---|
| [Nager.Date](https://date.nager.at) `PublicHolidays/{year}/SG` | Singapore public holidays (observed dates) | cached 12 h |
| [Open-Meteo forecast](https://open-meteo.com) | 16-day daily rain chance and temperature at each island | cached 30 min |
| [Open-Meteo archive](https://open-meteo.com/en/docs/historical-weather-api) | Same dates last year, for trips beyond the forecast | cached 24 h |
| [data.gov.sg traffic images](https://data.gov.sg) (LTA) | Cameras 2701, 2702 (Woodlands) and 4703, 4713 (Tuas) | cached 1 min |
| Dive season guide (in `public/app.js`) | Best months, animals, trip length per site | hand-curated from the sources listed on the page |

All four live feeds allow direct browser calls and need no API key. If a feed goes down, the page keeps showing the last good copy.

## Caveats

- Holiday dates come from Nager.Date, not MOM. Check [MOM's official list](https://www.mom.gov.sg/employment-practices/public-holidays) before you apply for leave.
- Dive seasons are typical, not guaranteed. Animals are wild, and parks and resorts change their opening dates. Confirm with your dive operator.
- "Last year's weather" is not a forecast. The app labels it clearly and tells you the date the real forecast becomes available.
- The app can't read traffic from the camera images. You judge the queues yourself.
- The plan counts any day you're not at work as a day off, including weekends.

## Files

```
johor-escape/
  public/index.html  page structure
  public/styles.css  sign-gantry look in deep-water blue, light and dark themes
  public/app.js      API calls, break finder, leave optimiser, verdicts, dive guide, cameras
  server.js          tiny static server for local development (no dependencies)
  package.json       npm start
  .github/workflows/pages.yml   deploys public/ to GitHub Pages
```
