# Rutina

A personal management web app in Spanish. Tasks, workouts, personal finances, a unified calendar, and points with monthly achievements, all in one place. It runs entirely in the browser and deploys as a static site to GitHub Pages.

## Modules

| Section | What it does |
|---|---|
| **Hoy** | Today's focus (overdue tasks plus today's tasks by priority), today's workout, the week drawn as tally marks, quick actions, and widgets you can reorder or hide. |
| **Tareas** | Day, week (drag a task to another day), month and full-list views, with search and filters. Supports subtasks, recurring tasks, deadlines and productivity stats. Unfinished tasks are never auto-completed: they show as overdue and you choose whether to reschedule them or mark them as not done. |
| **Agenda** | Day, week and month calendar that combines tasks, workouts and deadlines. Items are views of the original records, never copies. |
| **Entreno** | Weekly plan by day, routines, a library of 50+ exercises with a muscle map, a rule-based recommender (no AI), live session logging (sets, reps, weight, rest timer, swap or skip an exercise), history, PRs and charts. |
| **Finanzas** | Balance, income, expenses, savings and savings rate by month, quarter or year. Transactions with search, CSV import and export, budgets with alerts, savings goals with a projected completion date, recurring transactions without duplicates, and reports. |
| **Logros** | Fitness and productivity points shown separately, levels, achievements, streaks, a ranking of your months, yearly history and a point ledger. **It never reads financial data**; an automated test checks this. |
| **Ajustes** | Profile, currency, goals, editable point rules, categories, JSON backup and restore, demo data and full reset. |

## Points rules

- Points are awarded only when an activity is **completed**. Planned items earn nothing.
- Each activity holds **at most one award at a time**. Repeated clicks award nothing extra.
- Editing a completed activity does not change its points.
- Reopening a task (or unmarking a workout) posts a **reversal**. Completing it again awards once more under the current rules.
- Deleting a completed activity reverses its points. Resting never subtracts points.
- Changing the rules keeps historical points unless you choose **Recalcular** in Ajustes.
- Workouts: base points by intensity, a duration bonus with a cap, and a maximum per session. If fewer than 50% of sets are done, the base scales down proportionally.
- Every movement is recorded in the ledger (Logros → Registro de puntos).

## Data and privacy

- Everything is stored in this browser's `localStorage` and saved automatically.
- On startup the app asks the browser for **persistent storage** (`navigator.storage.persist()`), so data isn't evicted to free space. Ajustes shows whether it was granted.
- If more than 7 days pass without exporting a backup, a reminder appears with a button to download it.
- On iPhone, add the app to the home screen: Safari can delete data from websites that go unused for 7 days.
- **No sync across devices.** To move your data, export a JSON backup and import it on the other device.
- No bank connections, passwords, API keys or accounts. Imported transactions are labelled "Importado".
- Access to data goes through a `StorageAdapter` (`app/src/services/storage.ts`). Adding sync would need a backend with authentication (for example Supabase or Firebase) and an adapter that implements `load`/`save`. Nothing else in the app would change.

## Development

Requires **Node 20.19+ or 22.12+** (Vite 8).

All app code is in the `app/` folder:

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests: points, ledger, recurrence, finance, persistence, privacy
npm run build      # type check + production build in dist/
npm run preview    # serve the build
```

On first launch you can start with an empty app or load sample data. You can delete the sample data later from Ajustes without touching anything you created yourself.

## Deploying to GitHub Pages

1. Create a repository on GitHub and push this project to the `main` branch.
2. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Each push to `main` runs `.github/workflows/deploy.yml`, which installs dependencies in `app/`, runs the tests, builds and publishes `app/dist`.
4. The app will be available at `https://<user>.github.io/<repository>/`.

The `base` path is derived automatically from the repository name (`GITHUB_REPOSITORY`). For a custom domain or a `<user>.github.io` repository, set `VITE_BASE=/` in the workflow. Navigation uses `HashRouter` (`/#/tareas`), so reloading any page works without server configuration.

## Structure

```
.github/workflows/   deployment to GitHub Pages
app/                 the app (Vite + React + TypeScript)
  index.html, package.json, vite.config.ts
  public/
  src/
    components/      UI kit (buttons, modal, form, progress, tally marks, charts) and layout
    features/
      dashboard/     Hoy
      tasks/         logic.ts (pure) + views
      calendar/      unified items (derived, never copied)
      fitness/       library.ts, recommend.ts, stats.ts + views and the live session
      finance/       calc.ts (totals, budgets, recurrence, CSV) + views
      gamification/  scoring.ts (points engine), stats.ts (streaks, achievements) + Logros
      settings/
    services/        storage (adapter + validation), persistence, demo data
    store/           Zustand store: data and actions
    hooks/ utils/ types/
    test/
```
