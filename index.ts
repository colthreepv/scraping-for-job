import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  const QueryParams = {
    currentJobId: '4340545051',
    distance: '25',
    geoId: '91000007',
    keywords: 'Software Engineer',
    origin: 'JOBS_HOME_KEYWORD_HISTORY',
    refresh: 'true',
  }

  await page.goto(`https://www.linkedin.com/jobs/search/?${new URLSearchParams(QueryParams).toString()}`)
  await page.getByRole('link', { name: 'Show all Top job picks for you' }).click()

  // ---------------------
  await context.storageState({ path: 'storageState.json' })
  await context.close()
  await browser.close()
})()
