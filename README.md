# НейроКоффе (Вариант 5)

Проект содержит веб-прототип и полный набор SQL-скриптов для предметной области **«Система учёта заказов кафе «НейроКоффе»»**.

## Что реализовано

- Веб-интерфейс, где все основные операции выполняются прямо на сайте: управление столиками, заказами, меню, официантами и отчётами.
- Главное меню приложения с разделами из задания.
- SQL-схема БД `cafe_orders`.
- Хранимые процедуры: `OpenOrder`, `AddToOrder`, `CloseOrder`, `GetShiftReport`, `QuickOrder`.
- Триггеры контроля данных.
- Аналитические запросы + `EXPLAIN` + индексы.
- Тестовый сценарий (последовательность SQL-команд).

## Структура

- `index.html` — сайт/GUI.
- `src/styles.css` — стили.
- `src/app.js` — логика интерфейса.
- `sql/01_schema.sql` — DDL + FK + индексы.
- `sql/02_procedures.sql` — процедуры.
- `sql/03_triggers.sql` — триггеры.
- `sql/04_analytics_explain.sql` — аналитика и explain.
- `sql/05_test_cases.sql` — тестовый прогон.
- `sql/06_audit_and_security.sql` — аудит-триггеры, представления, пользователь аудитора.
- `scripts/cafe_backup.sh` — автоматизация backup 24/7.
- `scripts/cafe_verify.sh` — ежедневная проверка восстановляемости.
- `docs/cafe_audit_backup_report.md` — письменный отчёт по аудиту/backup/recovery.

## Запуск сайта

Откройте `index.html` в браузере.

## Прогон SQL

```bash
mysql -u root -p < sql/01_schema.sql
mysql -u root -p < sql/02_procedures.sql
mysql -u root -p < sql/03_triggers.sql
mysql -u root -p < sql/05_test_cases.sql
```

После этого выполните:

```bash
mysql -u root -p < sql/04_analytics_explain.sql
```

и зафиксируйте планы выполнения до/после индексации в табличном виде (шаблон в файле).
