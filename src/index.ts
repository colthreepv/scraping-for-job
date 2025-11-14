import { chromium } from 'playwright'

function cleanText(text: string | null): string {
  if (!text)
    return ''
  return text.replace(/\s+/g, ' ').trim()
}

(async () => {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ storageState: 'storageState.json' })
  const page = await context.newPage()

  const QueryParams = {
    currentJobId: '4340545051',
    distance: '25',
    f_WT: '2',
    geoId: '91000007',
    keywords: 'Software Engineer',
    origin: 'JOBS_HOME_KEYWORD_HISTORY',
    refresh: 'true',
  }

  await page.goto(`https://www.linkedin.com/jobs/search/?${new URLSearchParams(QueryParams).toString()}`)
  const containerToScroll = page.locator('.scaffold-layout__list > div')

  // Keep scrolling until the feedback selector appears
  while (true) {
    await containerToScroll.evaluate((el: any) => {
      el.scrollTop = el.scrollHeight
    })

    const feedbackExists = await page.locator('.jobs-list-feedback--fixed-width').count()
    console.warn('Feedback exists:', feedbackExists)
    if (feedbackExists > 0)
      break
  }

  // Scroll back up to load lazy-loaded components
  await containerToScroll.evaluate((el: any) => {
    el.scrollTop = 0
  })

  const list = page.locator('.scaffold-layout__list > div > ul > li')
  const results = []

  for (let i = 0; i < await list.count(); i++) {
    const li = list.nth(i)

    // Make sure the job item is actually rendered (lazy-loaded lists only render visible items)
    await li.scrollIntoViewIfNeeded()

    results.push({
      title: cleanText(await li.locator('.artdeco-entity-lockup__title').textContent()),
      company: cleanText(await li.locator('.artdeco-entity-lockup__subtitle').textContent()),
      location: cleanText(await li.locator('.artdeco-entity-lockup__caption').textContent()),
    })
  }

  // Print the results
  console.warn('Results:', results)

  // ---------------------
  await context.storageState({ path: 'storageState.json' })
  await context.close()
  await browser.close()
})()
