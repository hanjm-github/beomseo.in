# School Meals FastAPI

## Endpoints

- `GET /api/school-info/meals/today`
- `GET /api/school-info/meals?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/school-info/meals/{meal_date}/ratings`
- `GET /api/school-info/meals/notifications/subscription?installationId=...`
- `PUT /api/school-info/meals/notifications/subscription`
- `DELETE /api/school-info/meals/notifications/subscription?installationId=...`

All endpoints are public. Read requests use MySQL only and never call NEIS directly.

## Response Shape

Each meal entry returns:

- `id`
- `date`
- `status`
- `service`
- `serviceLabel`
- `menuItems`
- `previewText`
- `note`
- `isNoMeal`
- `calorieText`
- `caloriesKcal`
- `originItems`
- `nutritionItems`
- `ratings`
- `syncedAt`

Missing dates are synthesized as `isNoMeal=true` entries so the frontend can render weekend and holiday gaps without storing placeholder rows.

`ratings` shape:

- `taste.averageScore`, `taste.totalCount`, `taste.myScore`, `taste.distribution[]`
- `anticipation.averageScore`, `anticipation.totalCount`, `anticipation.myScore`, `anticipation.distribution[]`

`POST /api/school-info/meals/{meal_date}/ratings` body:

```json
{
  "category": "taste",
  "score": 4
}
```

- `category`: `taste` | `anticipation`
- `score`: `1` ~ `5`
- the backend stores one score per browser/user for each `meal_date + category`
- rating write policy:
  - `taste`: only allowed on the current KST date
  - `anticipation`: allowed on the current or upcoming KST date
  - any past meal date returns `422`
  - dates without an actual stored lunch meal still return `404`

## PWA Meal Notifications

The notification subscription API is device-scoped. Each installed PWA stores one
subscription row keyed by `installationId`.

`PUT /api/school-info/meals/notifications/subscription` body:

```json
{
  "installationId": "uuid-v4",
  "enabled": true,
  "notificationTime": "07:30",
  "timezone": "Asia/Seoul",
  "fcmToken": "fcm-registration-token"
}
```

- `enabled=true` requires `fcmToken`
- `notificationTime` must be `HH:MM`
- `timezone` must be a valid IANA timezone
- `DELETE` removes the installed-device subscription entirely

Reminder delivery uses Firebase Admin and is intended to be run by cron once per minute.
The sender script only delivers once per local date per installation and skips dates
with no stored lunch menu.

## Sync Script

Run a manual sync:

```bash
cd backend
python scripts/sync_school_meals.py --year current
```

Dry run:

```bash
python scripts/sync_school_meals.py --year current --dry-run
```

Run the reminder sender:

```bash
python scripts/send_school_meal_notifications.py
```

Dry run reminder delivery:

```bash
python scripts/send_school_meal_notifications.py --dry-run
```

Cron example:

```cron
10 */6 * * * cd /path/to/repo/backend && /path/to/venv/bin/python scripts/sync_school_meals.py --year $(date +\%Y)
* * * * * cd /path/to/repo/backend && /path/to/venv/bin/python scripts/send_school_meal_notifications.py
```

## Data Source

- Official endpoint: `https://open.neis.go.kr/hub/mealServiceDietInfo`
- Filters:
  - school and office codes from `backend/.env`
  - lunch only (`MMEAL_SC_CODE == "2"`)

## Required Notification Environment

- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `WEB_APP_ORIGIN`
