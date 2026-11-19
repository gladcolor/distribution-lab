# Distributions in the Field

Ten short interactive lessons on the probability distributions behind mosquito larval surveys, insect counts and ecological data. Every chart is a live simulation that you can change with sliders and buttons.

- English: https://gladcolor.github.io/distribution-lab/
- 中文版：https://gladcolor.github.io/distribution-lab/zh/

The "En / 中" switch in the top bar moves between the two languages and keeps the lesson you are reading.

## Lessons

| # | Topic | Field question |
|---|---|---|
| Start | What is a distribution? | Why do repeated dips give different counts? |
| 1 | Binomial | How many dips until I find larvae that are there? |
| 2 | Poisson | What do counts look like when larvae are scattered at random? |
| 3 | Negative binomial | Why are most dips empty while a few are full? |
| 4 | Zero-inflated counts | Which zeros come from habitats that cannot hold larvae? |
| 5 | Lognormal | Why does the mean density sit far above the typical habitat? |
| 6 | Survival and the exponential | How many adults live long enough to transmit? |
| 7 | Beta | How sure am I about a share measured on a small sample? |
| 8 | Normal and the central limit theorem | Why do averages behave when single counts do not? |
| 9 | Bootstrap and permutation | How do I get an interval or a P value when no formula fits? |
| 10 | Concentration curves | How much of the larvae sit in the most productive habitats? |

The page ends with a field guide: a table for choosing a distribution, a glossary and a reading list.

## Run it on your own computer

There is nothing to install or build. Download the folder and open `index.html` (English) or `zh/index.html` (Chinese) in a browser. The pages need no internet connection.

## Files

| File | Purpose |
|---|---|
| `index.html` | The English page: lesson text and layout |
| `zh/index.html` | The Chinese page, with the same structure |
| `style.css` | Styles shared by both pages |
| `core.js` | Random number generators, probability functions and summary statistics |
| `chart.js` | A small canvas chart helper (bars, lines, bands, markers, hover read-outs) |
| `app.js` | The twelve interactive labs and the quizzes, with labels in both languages |
| `test_core.js` | Checks of the math in `core.js` |

## Languages

Lesson text lives in the two HTML files. Labels inside the labs live in `app.js` as `L('English', '中文')` pairs, and the page's `lang` attribute picks which one is shown. To change a label, edit both halves of the pair.

## Check the math

With Node.js installed:

```
node test_core.js
```

The script checks that each probability function sums to one, that each random generator reproduces its theoretical mean and variance, and that the summary functions return known answers.

## Data

All numbers on the page are simulated in your browser. The page contains no survey records.
