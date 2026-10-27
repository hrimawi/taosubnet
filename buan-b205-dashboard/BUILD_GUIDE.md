# B205 Data Viz Challenge: Track A build guide

**The question:** *"Where should we focus next quarter to grow sales?"*
**Short answer:** each branch has **one** department that sells well at its two sister branches but badly at home. Fixing those three departments is worth about **$17,000 a quarter (+5.3%)**.

---

## 0. What's here, and the line we did not cross

| File | What it is |
|---|---|
| `Team_Dashboard_starter.xlsx` | The workbook that sits **behind** your dashboard. It holds the data with helper columns, a data-check sheet, and formula tables you can check your PivotTables against. The **Dashboard** sheet is blank on purpose. |
| `BUILD_GUIDE.md` | This guide: the finding, the chart plan, draft wording, and the numbers to expect. |
| `build_starter.py` | Rebuilds the workbook from the CSV (`python build_starter.py supermarket_sales.csv out.xlsx`). |

The brief (sections 3 and 7) says AI may *suggest, explain, write formulas, draft a headline and critique*, but **may not draw your charts or build the dashboard.** So everything below is analysis, formulas and advice. **Your team still has to do these parts in Excel:**
- build the PivotTables,
- draw every chart,
- lay out the Dashboard sheet,
- write the final wording.

Treat every number in this guide like any other AI output: check it against your own PivotTable before it goes on the dashboard. Section 6 lists each number with where to check it.

### Step 1: confirm your file is the same data
Open the instructor's `SuperMarket_Analysis.xlsx` and check two things:
- it has **1,000 rows**;
- **Sum of Total** (it may be called *Sales*) is **$322,966.75**.

If both match, every number here applies, and you can build straight into the starter workbook. If your file labels the branches differently, match them by **City**: Yangon = A, Mandalay = B, Naypyitaw = C.

---

## 1. The finding (and why it isn't the dull one)

Most teams will chart sales by product line for the whole chain and report *"Food & beverages is our top seller."* That is the dull finding, and it's barely true. At chain level every product line is 15–17% of sales, and the top line beats the second by only $1,022. **Totalled across the chain, the product lines look flat. The story only shows when you split them by branch.**

**Sales by product line and branch, Q1 2019** (Calc sheet, block 2)

| Product line | A · Yangon | B · Mandalay | C · Naypyitaw | Chain |
|---|--:|--:|--:|--:|
| Electronic accessories | $18,317 | $17,051 | $18,969 | $54,338 |
| Fashion accessories | $16,333 | $16,413 | $21,560 | $54,306 |
| Food and beverages | $17,163 | **$15,215** ◀ | $23,767 | $56,145 |
| Health and beauty | **$12,598** ◀ | $19,981 | $16,615 | $49,194 |
| Home and lifestyle | $22,417 | $17,549 | **$13,896** ◀ | $53,862 |
| Sports and travel | $19,373 | $19,988 | $15,762 | $55,123 |
| **Branch total** | $106,200 | $106,198 | $110,569 | **$322,967** |

◀ marks each branch's weakest line. Each is a *different* department, and each is a department where a sister branch is strong:

**Each branch's weakest line against its sister branches** (Calc sheet, block 3)

| Branch | Weakest line | Its sales | Sister-branch average | Gap | Why it trails |
|---|---|--:|--:|--:|---|
| A · Yangon | Health & beauty | $12,598 | $18,298 | **$5,700** | Smaller baskets ($268 vs $349) *and* fewer purchases (47 vs 52.5) |
| B · Mandalay | Food & beverages | $15,215 | $20,465 | **$5,250** | Fewer purchases (50 vs 62); basket size is close ($304 vs $330) |
| C · Naypyitaw | Home & lifestyle | $13,896 | $19,983 | **$6,088** | Fewer purchases (45 vs 57.5) and smaller baskets ($309 vs $348) |
| | | | **Total** | **$17,038 = 5.3% of Q1 sales** | |

The **"Why it trails"** column turns the finding into an action:
- **Mandalay and Naypyitaw** need *more shoppers* in that department: placement, range and promotion.
- **Yangon** also needs *bigger baskets* in Health & beauty: bundles and upsell.

The sister branch that leads each department is the playbook to copy:
- **Mandalay** for Health & beauty ($19,981);
- **Naypyitaw** for Food & beverages ($23,767);
- **Yangon** for Home & lifestyle ($22,417).

The $17K target is conservative because it only matches the *average* sister branch. Matching the *best* sister branch would be about $24.5K (7.6%).

**Is it real or just noise?** Each cell holds only about 45–66 purchases, so some of the gap could be chance. As a quick check, I shuffled the branch labels at random 2,000 times. All three branches came out with a gap this large only about **4%** of the time. So the pattern is unlikely to be pure luck, but one quarter is thin evidence. That makes it a good *limitation* (section 4) and a reason to frame the recommendation as a **pilot**. Use this check if the manager pushes back; it doesn't need to be on the dashboard.

### Supporting facts (for the smaller panels)
- **March is not a collapse.** The raw March total ($109,456) looks 6% below January ($116,292), but the data stops on **30 March**. Per trading day, March was $3,649 against $3,472 in February, **up 5%**. (Calc, block 5)
- **Saturday is the busiest day:** $4,317 per Saturday against a $3,629 daily average (+19%). Monday is the slowest at $3,158. Each weekday occurs 12 or 13 times, so compare *per day*, never raw totals. (Calc, block 6)
- **7 pm is the busiest hour:** $446 per day against about $330 for an average hour. (Calc, block 7)

---

## 2. Draft headline (the story lead rewrites it in your own words)

Pick one and make it yours. It must be one sentence that someone could act on Monday morning.

1. **"Grow sales 5% next quarter by fixing each branch's one weak department: Health & beauty in Yangon, Food & beverages in Mandalay, Home & lifestyle in Naypyitaw."**
2. "Each branch loses about $5–6K a quarter in one department its sister branches sell well. Copy their playbook in those three departments for +$17K (5%)."
3. "Don't push one product line chain-wide. Pilot each branch's weakest department, copying the sister branch that leads it, worth $17K a quarter."

A subtitle under the headline can carry the scope: *"Supermarket chain, 3 branches, 1,000 purchases, 1 Jan–30 Mar 2019. Sales include 5% tax."*

---

## 3. Dashboard plan (one screen at 100% zoom)

Test the fit on the **smallest laptop screen anyone on the team has**. Zoom to 100%, hide gridlines (View → Gridlines), and make sure nothing needs scrolling. The rubric takes −5 if it does.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADLINE: one-sentence recommendation                                        │
│ subtitle: scope · period · "sales include 5% tax"                            │
├───────────┬───────────┬───────────┬───────────┬──────────────────────────────┤
│ Q1 sales  │ Purchases │ Avg       │ Sales/day │ Opportunity                  │
│ $323K     │ 1,000     │ $323      │ $3,629    │ $17K (+5.3%)                 │
├───────────┴───────────┴───────────┴───────────┼──────────────────────────────┤
│  [1] HERO: three small bar charts, one per    │ [2] Size of the prize        │
│  branch, product lines sorted high→low, the   │   bar: gap $ by branch       │
│  weak line in the accent color, others gray   │                              │
│  Yangon │ Mandalay │ Naypyitaw                ├──────────────────────────────┤
│                                               │ [3] Sales per day by month   │
│                                               │   (Jan · Feb · Mar)          │
├───────────────────────────────────────────────┴──────────────────────────────┤
│ Limitation: ...   Data note: ...                                             │
│ Team # · Name (data) · Name (design) · Name (story) · Name · Name            │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Colors:** one accent color for the three weak departments (and the opportunity bars), and **gray for everything else**. That's two colors in total, well inside "four plus gray." Don't color by branch, since that spends color on decoration.

**Optional 4th panel:** add it only if it fits without crowding. Use *"Saturday is the busiest day"* (sales per day by weekday) as a hint for *when* to run the department promotions.

---

## 4. Chart recipes

Every chart is drawn by you, in Excel. These are the settings that earn the Chart-choice and Design points.

### [1] Hero: one small bar chart per branch (comparison)
- **PivotTable** (one per branch, or one with a Branch slicer/filter):
  - Rows = Product line
  - Values = Sum of Total
  - Filter = Branch
  - Sort Largest → Smallest
  - Calc block 4 shows the sorted order to expect.
- **Chart:** clustered **bar** (horizontal), since the product-line names are long.
- Excel draws horizontal bars bottom-up. To put the biggest bar on top: Format Axis → *Categories in reverse order*.
- **Same scale on all three:** Format Axis → Bounds → Minimum **0**, Maximum **25,000**. Without this, the three charts look comparable when they aren't, which is a dishonest axis.
- Color all bars gray. Then click the weak bar **twice**, so only that point is selected, and set Format Data Point → Fill → accent color.
- **Remove clutter:**
  - legend, gridlines and the PivotChart field buttons (PivotChart Analyze → Field Buttons → Hide All);
  - add data labels in $K, or keep just the axis.
- **Title = finding, not label.** Examples:
  - *"Yangon: Health & beauty trails — $12.6K vs $18.3K at sister branches"*
  - *"Mandalay: Food & beverages trails — $15.2K vs $20.5K"*
  - *"Naypyitaw: Home & lifestyle trails — $13.9K vs $20.0K"*

### [2] Size of the prize (comparison)
- **Source:** Calc block 3, column E (Gap $). This is formula-traceable, which the brief allows.
- **Chart:** horizontal bar, 3 bars sorted largest first, starting at **0**, all in the accent color.
- **Label each bar** "Naypyitaw · Home & lifestyle" etc.
- **Title:** *"Closing the three gaps is worth $17K a quarter (+5.3%)"*

### [3] Sales per day by month (trend, done fairly)
- **Source:** Calc block 5, column D. Alternatively: a PivotTable of Sum of Total by Month, divided by the days per month from the Daily sheet (31 / 28 / 30).
- **Chart:** column chart, Jan → Feb → Mar left to right.
  - Bars start at **0**, so the differences will look small. That's honest, and that's fine.
  - If you'd rather zoom in, use a **line** with a clearly labelled axis. The brief allows lines not to start at zero.
- **Axis title:** "Sales per trading day ($)".
- **Title:** *"March is not a collapse: per day it beat February by 5%"*

### What not to use
- **No pie charts:** 6 product lines is more than 3 slices (−3).
- **No 3-D (−3).**
- **No raw monthly totals:** that's the March trap.
- **Don't chart `gross income` as profit** (see section 5).

---

## 5. Limitation and data note (draft text for the dashboard footer)

**Limitation (pick one; the first is strongest):**
> *Limitation: one quarter of data (1 Jan–30 Mar 2019) with only ~50 purchases per branch-department, so part of each gap may be chance — run it as a pilot and re-check after six weeks.*

Alternatives:
- *"The file has no cost data, so this targets sales, not profit."*
- *"Ratings run only 4–10, so satisfaction can't be compared fairly."*

**Data note: this is where the +2 bonus is.** The Checks sheet proves three real problems in the file itself:
1. `gross income` is identical to `Tax 5%` on all 1,000 rows. It is the sales tax, not profit.
2. `gross margin percentage` is the same 4.76% on every row (that's 5 ÷ 105, the tax rate).
3. `cogs` equals Unit price × Quantity on every row. It is pre-tax *revenue*, not cost of goods sold.

> *Data note: the file's "gross income" column is just the 5% sales tax and "cogs" is pre-tax sales, so it holds no real profit or cost data. We used Total (sales incl. tax) for every figure.*

Two smaller flags (from Checks):
- no rating is below 4 on a 10-point scale;
- 31 March is missing.

---

## 6. Number-by-number check sheet (for the data lead)

Every number on the dashboard must match a PivotTable or formula in the workbook. Each mismatch costs −5. Build each PivotTable from the **Sales** table on the Data sheet (Insert → PivotTable → Table/Range: `Sales`).

| Dashboard number | Expected | PivotTable to build | Formula twin |
|---|--:|---|---|
| Q1 sales | $322,967 | Values: Sum of Total | Calc!B5 |
| Purchases | 1,000 | Values: Count of Invoice ID | Calc!B6 |
| Average purchase | $322.97 | Values: Average of Total | Calc!B7 |
| Sales per day | $3,629 | Q1 sales ÷ 89 days | Calc!B9 |
| Yangon H&B / sister avg | $12,598 / $18,298 | Rows Product line × Columns Branch, Sum of Total | Calc!C33, D33 |
| Mandalay F&B / sister avg | $15,215 / $20,465 | same | Calc!C34, D34 |
| Naypyitaw H&L / sister avg | $13,896 / $19,983 | same | Calc!C35, D35 |
| Gaps | $5,700 / $5,250 / $6,088 | sister avg − own (from the pivot above) | Calc!E33:E35 |
| Opportunity | $17,038 (5.3%) | sum of gaps ÷ Q1 sales | Calc!E36:E37 |
| Sales per day Jan / Feb / Mar | $3,751 / $3,472 / $3,649 | Rows Month, Sum of Total, ÷ 31 / 28 / 30 | Calc!D52:D54 |
| March vs February per day | +5.1% | | Calc!F54 |

**Rounding:** if a title says "$12.6K", the workbook has to show $12,598 somewhere a grader can find it. Round consistently. Don't write "$12.5K" in one place and "$12.6K" in another.

---

## 7. Traps the rubric checks for

| Trap | Do this instead |
|---|---|
| **March looks like a collapse** in raw totals | Compare per trading day (31 / 28 / 30) |
| Charting `gross income` as profit | It's just the tax. Say so in the data note for the bonus |
| **Weekday totals** (12 Mondays vs 13 Tuesdays) | Compare sales per day |
| **Small multiples with different axis maxima** | Fix all three at $0–$25,000 |
| Product lines in alphabetical order | Sort largest → smallest |
| Coloring every bar | Accent for the point, gray for context |
| **Titles like "Sales by Product Line"** | State the finding |
| Calling Total "revenue" without a qualifier | It **includes** 5% tax. Say "sales (incl. tax)" once in the subtitle |

---

## 8. Skeptical-manager questions to rehearse

- **"Where does $17K come from?"** It's the sum of the three gaps, where each gap is the sister-branch average minus this branch. See Calc block 3 and the PivotTable.
- **"Why not just push Food & beverages everywhere?"** It already leads at chain level by only $1K. It is *Mandalay's* weak line but Naypyitaw's *strongest*. One chain-wide push spends money where sales are already high.
- **"Couldn't this be luck?"** Possibly, since it's one quarter. That's why it's a pilot. A random shuffle of branch labels produced three gaps this size only about 4% of the time.
- **"Isn't March down?"** Not per day. March beat February by 5%. The raw total is lower only because the data stops on 30 March.
- **"What will it do to profit?"** We can't say. The file has no real cost data (see the data note).

---

## 9. Team line and pre-submit checklist

**Names line** (bottom of the dashboard). Every member, with the three job owners marked:
> Team # · Full Name (data) · Full Name (design) · Full Name (story) · Full Name · Full Name

**Pre-submit checklist:**

- [ ] **Traceable:** every dashboard number traces to a PivotTable or formula (section 6 above).
- [ ] **One screen:** it fits at 100% zoom with no scrolling, checked on the smallest laptop.
- [ ] **Headline:** it's at the top, one sentence, and someone can act on it Monday.
- [ ] **Chart rules:** no 3-D, no pie with more than 3 slices, four colors plus gray at most.
- [ ] **Axes:** bars start at zero, every axis is labelled, and all three small multiples share the same max.
- [ ] **Titles:** every chart title states a finding.
- [ ] **Fair comparisons:** months and weekdays are compared per day.
- [ ] **Limitation and data note:** one limitation is on the dashboard, plus the data note for the bonus.
- [ ] **Names:** every member's full name is on the dashboard, with the data, design and story owners marked.
- [ ] **Clean-up:** the Dashboard is the first sheet, and the two placeholder notes in A1:A2 are deleted.
- [ ] **File name:** the file is renamed to `Team#_Dashboard.xlsx` (your real team number).
