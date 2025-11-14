import { chromium } from 'playwright'

function cleanText(text: string | null): string {
  if (!text)
    return ''
  return text.replace(/\s+/g, ' ').trim()
}

function normalizeDescription(text: string | null): string {
  if (!text)
    return ''

  // 1) Normalise newlines
  const unified = text.replace(/\r\n/g, '\n')

  // 2) Trim each line and drop empty lines (no blank paragraphs)
  const lines = unified
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')

  // 3) Re-join and collapse long runs of spaces/tabs inside lines
  const collapsed = lines.join('\n').replace(/[ \t]{2,}/g, ' ')

  // 4) Escape newline characters as '\n' for storage
  return collapsed.replace(/\n/g, '\\n')
}

(async () => {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ storageState: 'storageState.json' })
  const page = await context.newPage()

  const QueryParams = {
    currentJobId: '4331118530',
    distance: '25',
    f_WT: '2',
    geoId: '91000007',
    keywords: 'Software Engineer',
    origin: 'JOBS_HOME_KEYWORD_HISTORY',
    refresh: 'true',
  }

  let response
  try {
    response = await page.goto(`https://www.linkedin.com/jobs/search/?${new URLSearchParams(QueryParams).toString()}`)
  }
  catch (error) {
    console.error('Error navigating to the page:', error)
    // Back off briefly before exiting on hard navigation errors
    await page.waitForTimeout(60_000)
    return
  }

  if (response && response.status() === 429) {
    console.error('Received HTTP 429 (Too Many Requests) from LinkedIn. Backing off for 60 seconds and exiting.')
    await page.waitForTimeout(60_000)
    return
  }

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

    // Extract basic info from list item
    const title = cleanText(await li.locator('.artdeco-entity-lockup__title').textContent())
    const company = cleanText(await li.locator('.artdeco-entity-lockup__subtitle').textContent())
    const location = cleanText(await li.locator('.artdeco-entity-lockup__caption').textContent())

    // Click to open job details
    await li.click()

    // Wait for the details panel to load
    await page.waitForSelector('.job-details-jobs-unified-top-card__tertiary-description-container > span')

    // Extract details from job panel - get direct child spans only
    const jobPanel = page.locator('.job-details-jobs-unified-top-card__tertiary-description-container > span')

    // Get direct children spans using evaluate to be more precise
    const spanData = await jobPanel.evaluate((el: HTMLElement) => {
      return Array.from(el.children).map(span => span.textContent?.trim() || '')
    })

    const country = cleanText(spanData[0] || '')
    const timeAgo = cleanText(spanData[2] || '')
    const applicantsEstimate = cleanText(spanData[4] || '')

    // Extract main description and normalize newlines
    const descriptionContainer = page.locator('.jobs-box__html-content')
    const rawDescription = await descriptionContainer.textContent().catch(() => null)
    const description = normalizeDescription(rawDescription)

    // Check for Easy Apply button
    const easyApplyButtons = page.locator('span.artdeco-button__text')
    let easyApply = false
    const buttonCount = await easyApplyButtons.count()
    for (let j = 0; j < buttonCount; j++) {
      const buttonText = await easyApplyButtons.nth(j).textContent().catch(() => null)
      if (buttonText && buttonText.includes('Easy Apply')) {
        easyApply = true
        break
      }
    }

    results.push({
      title,
      company,
      location,
      country,
      timeAgo,
      applicantsEstimate,
      description,
      easyApply,
    })
  }

  // Print the results
  console.warn('Results:', results)

  // ---------------------
  await context.storageState({ path: 'storageState.json' })
  await context.close()
  await browser.close()
})()
