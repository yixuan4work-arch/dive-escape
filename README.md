# Johor Escape

*Escape from CT Hub… to Johor.* A local web app that plans your long weekends across the Causeway. It tells you:

- **When to go**: every Singapore public holiday in the next 12 months, with the longest break you can get for 0 to 5 leave days.
- **How much leave to take**: set how many leave days you can spare, and it picks the set of breaks that gives you the most days off.
- **Go or not**: a weather verdict for JB city, Legoland & Puteri Harbour, Desaru Coast and Malacca. It uses the 16-day forecast when your trip is close enough. Otherwise it shows what the weather did on the same dates last year.
- **Which checkpoint, right now**: live LTA cameras at Woodlands and Tuas, refreshed every minute, plus this weekend's forecast.

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

- **Clarity:** Office workers in Singapore who like weekend trips to Johor miss long weekends, or plan them badly.
- **Consequence:** They spot a long weekend too late to plan, use more leave than they need to, get rained out, or sit in hours of checkpoint traffic.
- **Cause:** The information they need is in four different places: the holiday calendar, their own leave maths, the weather, and the checkpoint cameras. Nothing joins them up into one decision.
- **Confirmation:** This is still an assumption from our interview. Test it by asking colleagues how they plan their last Johor trip.

The app helps people make one decision: **go or not, when, and how many leave days to take.**

## Data sources (no API keys needed)

| Feed | Used for | Refreshed |
|---|---|---|
| [Nager.Date](https://date.nager.at) `PublicHolidays/{year}/SG` | Singapore public holidays (observed dates) | cached 12 h |
| [Open-Meteo forecast](https://open-meteo.com) | 16-day daily rain chance and temperature | cached 30 min |
| [Open-Meteo archive](https://open-meteo.com/en/docs/historical-weather-api) | Same dates last year, for trips beyond the forecast | cached 24 h |
| [data.gov.sg traffic images](https://data.gov.sg) (LTA) | Cameras 2701, 2702 (Woodlands) and 4703, 4713 (Tuas) | cached 1 min |

All four feeds allow direct browser calls. The page caches each response for the time shown above, and if a feed goes down it keeps showing the last good copy.

## Caveats

- Holiday dates come from Nager.Date, not MOM. Check [MOM's official list](https://www.mom.gov.sg/employment-practices/public-holidays) before you apply for leave.
- "Last year's weather" is not a forecast. The app labels it clearly and tells you the date the real forecast becomes available.
- The app can't read traffic from the camera images. You judge the queues yourself.
- The plan counts any day you're not at work as a day off, including weekends.

## Files

```
johor-escape/
  public/index.html  page structure
  public/styles.css  expressway-sign look, light and dark themes
  public/app.js      API calls, break finder, leave optimiser, verdicts, cameras
  server.js          tiny static server for local development (no dependencies)
  package.json       npm start
  .github/workflows/pages.yml   deploys public/ to GitHub Pages
```
