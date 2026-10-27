"""Build the B205 Track A starter workbook from the supermarket sales CSV.

The workbook holds everything *behind* the dashboard -- the data with helper
columns, data-quality checks, and formula tables -- so the team can check its
own PivotTables against it. The Dashboard sheet is left empty on purpose: the
assignment requires the charts and layout to be built by the team in Excel.

Usage:
  python build_starter.py <supermarket_sales.csv> <output.xlsx>

Every number on the Checks, Daily and Calc sheets is an Excel formula over the
Data sheet, so it recalculates if the data changes.
"""

from __future__ import annotations

import csv
import sys
from datetime import datetime

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

FONT = "Arial"
N = 1000  # data rows
LAST = N + 1  # last data row on the Data sheet
DAYS = 89  # 1 Jan - 30 Mar 2019

BRANCHES = ["A", "B", "C"]
CITIES = {"A": "Yangon", "B": "Mandalay", "C": "Naypyitaw"}
LINES = [
    "Electronic accessories",
    "Fashion accessories",
    "Food and beverages",
    "Health and beauty",
    "Home and lifestyle",
    "Sports and travel",
]
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MONTHS = [(1, "Jan"), (2, "Feb"), (3, "Mar")]

MONEY = '"$"#,##0'
MONEY2 = '"$"#,##0.00'
PCT = "0.0%"
INT = "#,##0"

TITLE = Font(name=FONT, size=14, bold=True)
H2 = Font(name=FONT, size=11, bold=True)
BODY = Font(name=FONT, size=10)
BOLD = Font(name=FONT, size=10, bold=True)
NOTE = Font(name=FONT, size=9, italic=True, color="666666")
HEAD_FILL = PatternFill("solid", fgColor="E7E6E6")
FLAG_FILL = PatternFill("solid", fgColor="FFF2CC")
THIN = Side(style="thin", color="BFBFBF")
UNDER = Border(bottom=THIN)


def col(name: str) -> str:
    """Absolute range of a Data column by header, e.g. col('Total') -> Data!$J$2:$J$1001."""
    letter = DATA_COLS[name]
    return f"Data!${letter}$2:${letter}${LAST}"


HEADERS = [
    "Invoice ID", "Branch", "City", "Customer type", "Gender", "Product line",
    "Unit price", "Quantity", "Tax 5%", "Total", "Date", "Time", "Payment",
    "cogs", "gross margin percentage", "gross income", "Rating",
]
HELPERS = ["Month", "Month name", "Weekday no", "Weekday", "Hour"]
DATA_COLS = {h: get_column_letter(i + 1) for i, h in enumerate(HEADERS + HELPERS)}


def style_cell(c, font=BODY, fmt=None, fill=None, align=None, border=None):
    c.font = font
    if fmt:
        c.number_format = fmt
    if fill:
        c.fill = fill
    if align:
        c.alignment = align
    if border:
        c.border = border


def header_row(ws, row, start_col, labels):
    for i, label in enumerate(labels):
        c = ws.cell(row=row, column=start_col + i, value=label)
        style_cell(c, BOLD, fill=HEAD_FILL, border=UNDER,
                   align=Alignment(horizontal="center" if i else "left", wrap_text=True))


def note(ws, ref, text):
    ws[ref] = text
    style_cell(ws[ref], NOTE)


def build_dashboard(wb):
    ws = wb.active
    ws.title = "Dashboard"
    ws["A1"] = "Build your dashboard on this sheet in Excel (charts, headline, limitation, team names)."
    ws["A2"] = "Delete these two notes before you submit. See BUILD_GUIDE.md for the plan and the numbers to expect."
    for r in ("A1", "A2"):
        style_cell(ws[r], NOTE)
    ws.sheet_view.showGridLines = False


def build_data(wb, rows):
    ws = wb.create_sheet("Data")
    for i, h in enumerate(HEADERS + HELPERS, start=1):
        ws.cell(row=1, column=i, value=h)
    for r, rec in enumerate(rows, start=2):
        for i, h in enumerate(HEADERS, start=1):
            v = rec[h]
            if h == "Date":
                v = datetime.strptime(v, "%m/%d/%Y")
            elif h == "Time":
                v = datetime.strptime(v, "%H:%M").time()
            elif h == "Quantity":
                v = int(v)
            elif h in ("Unit price", "Tax 5%", "Total", "cogs",
                       "gross margin percentage", "gross income", "Rating"):
                v = float(v)
            ws.cell(row=r, column=i, value=v)
        d, t = DATA_COLS["Date"], DATA_COLS["Time"]
        ws[f"{DATA_COLS['Month']}{r}"] = f"=MONTH({d}{r})"
        ws[f"{DATA_COLS['Month name']}{r}"] = f'=TEXT({d}{r},"mmm")'
        ws[f"{DATA_COLS['Weekday no']}{r}"] = f"=WEEKDAY({d}{r},2)"
        ws[f"{DATA_COLS['Weekday']}{r}"] = f'=TEXT({d}{r},"ddd")'
        ws[f"{DATA_COLS['Hour']}{r}"] = f"=HOUR({t}{r})"

    fmts = {"Unit price": MONEY2, "Tax 5%": MONEY2, "Total": MONEY2, "cogs": MONEY2,
            "gross income": MONEY2, "Date": "yyyy-mm-dd", "Time": "hh:mm",
            "gross margin percentage": "0.000000"}
    for h, letter in DATA_COLS.items():
        for r in range(1, LAST + 1):
            c = ws[f"{letter}{r}"]
            c.font = BOLD if r == 1 else BODY
            if r > 1 and h in fmts:
                c.number_format = fmts[h]
        ws.column_dimensions[letter].width = max(10, min(24, len(h) + 4))
    ws.column_dimensions[DATA_COLS["Product line"]].width = 22

    end = get_column_letter(len(HEADERS) + len(HELPERS))
    table = Table(displayName="Sales", ref=f"A1:{end}{LAST}")
    table.tableStyleInfo = TableStyleInfo(name="TableStyleLight1", showRowStripes=True)
    ws.add_table(table)
    ws.freeze_panes = "B2"
    first_helper = DATA_COLS["Month"]
    ws[f"{first_helper}1"].comment = Comment(
        "Helper columns (Month, Month name, Weekday no, Weekday, Hour) are formulas "
        "built from Date and Time -- allowed by the brief.", "Starter")


def build_checks(wb):
    ws = wb.create_sheet("Checks")
    ws["A1"] = "Data checks -- run these before charting (brief, section 2)"
    style_cell(ws["A1"], TITLE)
    note(ws, "A2", "Every result is a formula over the Data sheet. Yellow rows are problems "
                   "worth disclosing on the dashboard.")
    header_row(ws, 4, 1, ["Check", "Result", "Expected / what it means"])

    total, tax, cogs = col("Total"), col("Tax 5%"), col("cogs")
    price, qty, date = col("Unit price"), col("Quantity"), col("Date")
    checks = [
        ("Rows (purchases)", f"=COUNTA({col('Invoice ID')})", INT, "1,000", False),
        ("Blank cells in the 17 original columns", f"=COUNTBLANK(Data!$A$2:$Q${LAST})", INT,
         "0 -- nothing missing", False),
        ("Duplicate Invoice IDs",
         f"=SUMPRODUCT((COUNTIF({col('Invoice ID')},{col('Invoice ID')})>1)*1)", INT,
         "0 -- no purchase counted twice", False),
        ("First date", f"=MIN({date})", "yyyy-mm-dd", "2019-01-01", False),
        ("Last date", f"=MAX({date})", "yyyy-mm-dd",
         "2019-03-30 -- March 31 is missing, so March is a short month", True),
        ("Distinct trading days", f"=SUMPRODUCT(1/COUNTIF({date},{date}))", INT, "89", False),
        ("Calendar days first-to-last", "=B9-B8+1", INT,
         "89 -- equals the line above, so no day inside the range is missing", False),
        ("Days of March in the data", f'=COUNTIF(Daily!$B$2:$B${DAYS + 1},3)', INT,
         "30 of 31 -- compare months per day, never as raw totals", True),
        ("Lowest / highest Unit price", f'=TEXT(MIN({price}),"$0.00")&" / "&TEXT(MAX({price}),"$0.00")',
         None, "$10.08 / $99.96 -- plausible", False),
        ("Lowest / highest Quantity", f'=MIN({qty})&" / "&MAX({qty})', None, "1 / 10 -- plausible", False),
        ("Lowest / highest Rating", f'=MIN({col("Rating")})&" / "&MAX({col("Rating")})', None,
         "4 / 10 -- no rating below 4 on a 10-point scale: the scale looks truncated", True),
        ("Distinct values of 'gross margin percentage'",
         f"=IF(MAX({col('gross margin percentage')})=MIN({col('gross margin percentage')}),1,\"more than 1\")",
         None, "1 -- the same 4.76% on every row; it is 5/105, the tax rate, not a real margin", True),
        ("Rows where 'gross income' differs from 'Tax 5%'",
         f"=SUMPRODUCT(--(ABS({col('gross income')}-{tax})>0.0001))", INT,
         "0 -- 'gross income' is a copy of the sales tax, not profit. Do not chart it as profit", True),
        ("Rows where 'cogs' differs from Unit price x Quantity",
         f"=SUMPRODUCT(--(ABS({cogs}-{price}*{qty})>0.0001))", INT,
         "0 -- 'cogs' is pre-tax revenue, not cost of goods sold. The file has no real cost data", True),
        ("Rows where Total differs from cogs + Tax 5%",
         f"=SUMPRODUCT(--(ABS({total}-{cogs}-{tax})>0.0001))", INT,
         "0 -- Total = sales including 5% tax. Use Total for every sales figure", False),
        ("Rows where Branch and City disagree",
         "=" + "+".join(f'COUNTIFS({col("Branch")},"{b}",{col("City")},"<>{c}")'
                        for b, c in CITIES.items()), INT,
         "0 -- A = Yangon, B = Mandalay, C = Naypyitaw, one-to-one", False),
    ]
    for i, (label, formula, fmt, expect, flag) in enumerate(checks, start=5):
        ws.cell(row=i, column=1, value=label)
        ws.cell(row=i, column=2, value=formula)
        ws.cell(row=i, column=3, value=expect)
        for c in range(1, 4):
            style_cell(ws.cell(row=i, column=c), BODY, fill=FLAG_FILL if flag else None,
                       align=Alignment(wrap_text=True, vertical="top"))
        if fmt:
            ws.cell(row=i, column=2).number_format = fmt
        ws.cell(row=i, column=2).alignment = Alignment(horizontal="right", vertical="top")
    ws.column_dimensions["A"].width = 46
    ws.column_dimensions["B"].width = 18
    ws.column_dimensions["C"].width = 80
    ws.freeze_panes = "A5"


def build_daily(wb):
    ws = wb.create_sheet("Daily")
    header_row(ws, 1, 1, ["Date", "Month", "Weekday", "Sales", "Purchases"])
    for i in range(DAYS):
        r = i + 2
        ws[f"A{r}"] = f"=MIN({col('Date')})" if i == 0 else f"=A{r - 1}+1"
        ws[f"B{r}"] = f"=MONTH(A{r})"
        ws[f"C{r}"] = f'=TEXT(A{r},"ddd")'
        ws[f"D{r}"] = f"=SUMIFS({col('Total')},{col('Date')},A{r})"
        ws[f"E{r}"] = f"=COUNTIFS({col('Date')},A{r})"
        for c, fmt in zip("ABCDE", ("yyyy-mm-dd", "0", None, MONEY, INT)):
            style_cell(ws[f"{c}{r}"], BODY, fmt)
    note(ws, "G1", "One row per calendar day, 1 Jan - 30 Mar 2019. Used to count days per month and per weekday.")
    note(ws, "G2", f"Check: last date in column A must equal Checks!B9 (2019-03-30). Days with no sales: "
                   f"see G3.")
    ws["G3"] = f"=COUNTIF(D2:D{DAYS + 1},0)"
    style_cell(ws["G3"], BOLD)
    ws.column_dimensions["A"].width = 12
    ws.column_dimensions["D"].width = 12
    ws.freeze_panes = "A2"


def build_calc(wb):
    ws = wb.create_sheet("Calc")
    total, branch, line = col("Total"), col("Branch"), col("Product line")
    ws["A1"] = "Calc -- formula versions of the numbers on the dashboard"
    style_cell(ws["A1"], TITLE)
    note(ws, "A2", "Build your own PivotTable for each block and check it matches. If a number here and "
                   "your PivotTable disagree, find out why before it goes on the dashboard.")

    # 1. Headline KPIs
    ws["A4"] = "1. Quarter at a glance (Q1 2019, 1 Jan - 30 Mar)"
    style_cell(ws["A4"], H2)
    kpis = [
        ("Total sales (incl. 5% tax)", f"=SUM({total})", MONEY),
        ("Purchases", f"=COUNTA({col('Invoice ID')})", INT),
        ("Average purchase", "=B5/B6", MONEY2),
        ("Trading days", f"=COUNT(Daily!$A$2:$A${DAYS + 1})", INT),
        ("Sales per day", "=B5/B8", MONEY),
    ]
    for i, (label, formula, fmt) in enumerate(kpis, start=5):
        ws[f"A{i}"], ws[f"B{i}"] = label, formula
        style_cell(ws[f"A{i}"])
        style_cell(ws[f"B{i}"], BODY, fmt)
    note(ws, "C5", "Pivot check: Values = Sum of Total, no rows -> grand total.")

    # 2. Product line x branch
    ws["A11"] = "2. Sales by product line and branch -- the core finding"
    style_cell(ws["A11"], H2)
    header_row(ws, 12, 1, ["Product line"] + [f"{b} ({CITIES[b]})" for b in BRANCHES] + ["Chain"])
    for i, pl in enumerate(LINES, start=13):
        ws[f"A{i}"] = pl
        style_cell(ws[f"A{i}"])
        for j, b in enumerate(BRANCHES):
            c = ws.cell(row=i, column=2 + j, value=f'=SUMIFS({total},{line},$A{i},{branch},"{b}")')
            style_cell(c, BODY, MONEY)
        style_cell(ws.cell(row=i, column=5, value=f"=SUM(B{i}:D{i})"), BODY, MONEY)
    ws["A19"] = "Branch total"
    style_cell(ws["A19"], BOLD)
    for j in range(4):
        letter = get_column_letter(2 + j)
        style_cell(ws[f"{letter}19"], BOLD, MONEY)
        ws[f"{letter}19"] = f"=SUM({letter}13:{letter}18)"
    note(ws, "A20", "Pivot check: Rows = Product line, Columns = Branch, Values = Sum of Total. "
                    "At chain level every line is 15-17% of sales -- the gap only shows by branch.")

    header_row(ws, 22, 1, ["Purchases"] + BRANCHES)
    header_row(ws, 22, 6, ["Average purchase"] + BRANCHES)
    for i, pl in enumerate(LINES, start=23):
        ws[f"A{i}"] = pl
        ws[f"F{i}"] = pl
        style_cell(ws[f"A{i}"])
        style_cell(ws[f"F{i}"])
        for j, b in enumerate(BRANCHES):
            n = ws.cell(row=i, column=2 + j, value=f'=COUNTIFS({line},$A{i},{branch},"{b}")')
            style_cell(n, BODY, INT)
            src = get_column_letter(2 + j)
            a = ws.cell(row=i, column=7 + j, value=f"={src}{i - 10}/{src}{i}")
            style_cell(a, BODY, MONEY2)
    note(ws, "A29", "Pivot check: same pivot, Values = Count of Invoice ID, then Average of Total.")

    # 3. Each branch's weakest line vs its sister branches
    ws["A31"] = "3. Each branch's weakest line, against the average of its two sister branches"
    style_cell(ws["A31"], H2)
    header_row(ws, 32, 1, ["Branch", "Weakest line", "Its sales", "Sister-branch avg", "Gap ($)",
                           "Purchases", "Sister avg purchases", "Avg purchase", "Sister avg purchase"])
    for k, b in enumerate(BRANCHES):
        r = 33 + k
        bc = get_column_letter(2 + k)  # this branch's column in block 2
        sales = f"${bc}$13:${bc}$18"
        pos = f"MATCH(MIN({sales}),{sales},0)"
        ws[f"A{r}"] = f"{b} ({CITIES[b]})"
        ws[f"B{r}"] = f"=INDEX($A$13:$A$18,{pos})"
        ws[f"C{r}"] = f"=MIN({sales})"
        ws[f"D{r}"] = f"=(INDEX($E$13:$E$18,{pos})-C{r})/2"
        ws[f"E{r}"] = f"=D{r}-C{r}"
        cnt = f"${bc}$23:${bc}$28"
        ws[f"F{r}"] = f"=INDEX({cnt},{pos})"
        ws[f"G{r}"] = f"=(SUM(INDEX($B$23:$D$28,{pos},0))-F{r})/2"
        ws[f"H{r}"] = f"=C{r}/F{r}"
        ws[f"I{r}"] = f"=D{r}/G{r}"
        for c, fmt in zip("ABCDEFGHI", (None, None, MONEY, MONEY, MONEY, INT, "0.0", MONEY2, MONEY2)):
            style_cell(ws[f"{c}{r}"], BODY, fmt)
    ws["A36"] = "Total opportunity"
    ws["E36"] = "=SUM(E33:E35)"
    ws["A37"] = "As % of quarter sales"
    ws["E37"] = "=E36/B5"
    style_cell(ws["A36"], BOLD)
    style_cell(ws["A37"], BOLD)
    style_cell(ws["E36"], BOLD, MONEY)
    style_cell(ws["E37"], BOLD, PCT)
    note(ws, "A38", "Gap = what the branch would have sold in that line had it matched the average of the "
                    "other two branches. A conservative target: matching the best sister branch is larger.")

    # 4. Each branch's lines sorted high to low (for one small bar chart per branch)
    ws["A40"] = "4. Each branch's product lines, sorted high to low (one small bar chart per branch)"
    style_cell(ws["A40"], H2)
    for k, b in enumerate(BRANCHES):
        c0 = 1 + 3 * k
        bc = get_column_letter(2 + k)
        sales = f"${bc}$13:${bc}$18"
        header_row(ws, 41, c0, [f"{b} ({CITIES[b]})", "Sales"])
        for rank in range(1, 7):
            r = 41 + rank
            v = ws.cell(row=r, column=c0 + 1, value=f"=LARGE({sales},{rank})")
            name_col = get_column_letter(c0 + 1)
            n = ws.cell(row=r, column=c0, value=f"=INDEX($A$13:$A$18,MATCH({name_col}{r},{sales},0))")
            style_cell(v, BODY, MONEY)
            style_cell(n)
    note(ws, "A48", "In a PivotTable: Rows = Product line, filter Branch, Values = Sum of Total, "
                    "then sort Largest to Smallest.")

    # 5. Months, compared per day
    ws["A50"] = "5. Months compared fairly -- per trading day"
    style_cell(ws["A50"], H2)
    header_row(ws, 51, 1, ["Month", "Sales", "Days in data", "Sales per day", "Purchases per day",
                           "vs previous month"])
    for i, (m, name) in enumerate(MONTHS, start=52):
        ws[f"A{i}"] = name
        ws[f"B{i}"] = f"=SUMIFS({total},{col('Month')},{m})"
        ws[f"C{i}"] = f"=COUNTIF(Daily!$B$2:$B${DAYS + 1},{m})"
        ws[f"D{i}"] = f"=B{i}/C{i}"
        ws[f"E{i}"] = f"=COUNTIFS({col('Month')},{m})/C{i}"
        ws[f"F{i}"] = "" if i == 52 else f"=D{i}/D{i - 1}-1"
        for c, fmt in zip("ABCDEF", (None, MONEY, INT, MONEY, "0.0", PCT)):
            style_cell(ws[f"{c}{i}"], BODY, fmt)
    note(ws, "A55", "Raw March total looks 6% below January only because March has 30 days in the data "
                    "and January 31. Per day, March beat February.")

    # 6. Weekday, per day
    ws["A57"] = "6. Day of week -- average sales per day (each weekday occurs 12 or 13 times)"
    style_cell(ws["A57"], H2)
    header_row(ws, 58, 1, ["Weekday", "Sales", "Days", "Sales per day", "Purchases per day"])
    for i, d in enumerate(WEEKDAYS, start=59):
        ws[f"A{i}"] = d
        ws[f"B{i}"] = f'=SUMIFS({total},{col("Weekday")},A{i})'
        ws[f"C{i}"] = f"=COUNTIF(Daily!$C$2:$C${DAYS + 1},A{i})"
        ws[f"D{i}"] = f"=B{i}/C{i}"
        ws[f"E{i}"] = f'=COUNTIFS({col("Weekday")},A{i})/C{i}'
        for c, fmt in zip("ABCDE", (None, MONEY, INT, MONEY, "0.0")):
            style_cell(ws[f"{c}{i}"], BODY, fmt)

    # 7. Hour of day
    ws["A67"] = "7. Hour of day -- every day has the same opening hours, so totals compare fairly"
    style_cell(ws["A67"], H2)
    header_row(ws, 68, 1, ["Hour starting", "Sales", "Purchases", "Sales per day"])
    for i, h in enumerate(range(10, 21), start=69):
        ws[f"A{i}"] = h
        ws[f"B{i}"] = f"=SUMIFS({total},{col('Hour')},A{i})"
        ws[f"C{i}"] = f"=COUNTIFS({col('Hour')},A{i})"
        ws[f"D{i}"] = f"=B{i}/$B$8"
        for c, fmt in zip("ABCD", ('0":00"', MONEY, INT, MONEY)):
            style_cell(ws[f"{c}{i}"], BODY, fmt)

    widths = {"A": 26, "B": 22, "C": 14, "D": 22, "E": 14, "F": 22, "G": 18, "H": 14, "I": 18}
    for letter, w in widths.items():
        ws.column_dimensions[letter].width = w


def main(src: str, out: str) -> None:
    with open(src, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if len(rows) != N:
        raise SystemExit(f"expected {N} rows, got {len(rows)}")
    wb = Workbook()
    build_dashboard(wb)
    build_data(wb, rows)
    build_checks(wb)
    build_daily(wb)
    build_calc(wb)
    wb.save(out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
