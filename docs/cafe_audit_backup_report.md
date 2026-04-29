# Отчёт: аудит, журналы, резервное копирование и восстановление (кафе 24/7)

## 1) Аудит изменений триггерами
- Полный листинг DDL + триггеров + представлений в `sql/06_audit_and_security.sql`.
- Используются поля `shift_id` из `@current_shift` и `workstation` из `@workstation`.

### Примеры записей audit_log
```sql
SET @current_shift = '2026-04-29-morning';
SET @workstation = 'POS-01';

INSERT INTO orders(table_id, waiter_id, status) VALUES (1,1,'new'); -- ORDER_OPENED
UPDATE orders SET discount=10 WHERE order_id=1;                      -- DISCOUNT_CHANGED
UPDATE orders SET status='paid', total_amount=1200 WHERE order_id=1; -- ORDER_STATUS_TRANSITION + ORDER_AMOUNT_CHANGED
UPDATE orders SET total_amount=1000 WHERE order_id=1;                -- FRAUD_ATTEMPT + ERROR 45000

SELECT * FROM audit_log ORDER BY id DESC LIMIT 20;
```

## 2) General Log и бинарный лог
### Включение общего журнала
```sql
SET GLOBAL log_output='TABLE';
SET GLOBAL general_log='ON';
SELECT event_time, user_host, argument
FROM mysql.general_log
WHERE command_type='Query'
  AND event_time >= NOW() - INTERVAL 1 HOUR;
```

### my.cnf (требуемые параметры)
```ini
[mysqld]
log-bin = mysql-bin
binlog_format = ROW
expire_logs_days = 90
max_binlog_size = 50M
server-id = 1
```

### Демонстрация binlog для оплаты
```sql
UPDATE orders SET status='paid' WHERE order_id=101;
INSERT INTO payments(order_id, amount, method) VALUES (101, 1500, 'card');
UPDATE tables SET status='free' WHERE table_id=(SELECT table_id FROM orders WHERE order_id=101);
```
```bash
mysqlbinlog --base64-output=DECODE-ROWS -v /var/lib/mysql/mysql-bin.000001 | less
```

## 3) Аналитика по аудиту и аномалиям
```sql
-- Активность официантов за смену
SELECT waiter_id, COUNT(*) opened_orders, AVG(total_amount) avg_check,
       SUM(discount > 0) discounts_count
FROM orders
WHERE DATE(order_date)=CURDATE()
GROUP BY waiter_id;

-- Подозрительные скидки (>=20%)
SELECT waiter_id, COUNT(*) max_discount_count
FROM orders
WHERE discount >= 20
GROUP BY waiter_id
HAVING COUNT(*) >= 5;

-- Изменение цен блюд
SELECT * FROM v_price_changes LIMIT 100;
```

## 4) Резервные копии
### Полная копия
```bash
mysqldump --single-transaction --routines --triggers --events --master-data=2 \
  --default-character-set=utf8mb4 cafe > cafe_full_YYYYMMDD_HHMM.sql
gzip cafe_full_YYYYMMDD_HHMM.sql
```

### Специализированные копии
```bash
# Только структура
mysqldump --no-data cafe > cafe_schema.sql

# Справочники
mysqldump cafe menu_items tables waiters > cafe_reference.sql

# Оперативные за 1 день
mysqldump cafe orders --where="order_date >= CURDATE() - INTERVAL 1 DAY" > orders_last_day.sql
mysqldump cafe order_items --where="order_id IN (SELECT order_id FROM orders WHERE order_date >= CURDATE() - INTERVAL 1 DAY)" > order_items_last_day.sql

# Закрытые фискальные документы
mysqldump cafe orders order_items --where="status IN ('paid','closed')" > cafe_fiscal_month.sql
```

## 5) Восстановление после инцидента
### Инцидент
```sql
UPDATE orders SET status='closed' WHERE status='new';
```
Зафиксировать `T_error` (например, `2026-04-29 10:21:15`).

### Point-in-time recovery
```bash
# 1) развернуть полный бэкап 03:00
mysql < cafe_full_20260429_0300.sql

# 2) применить binlog до T_error - 1 сек
mysqlbinlog --stop-datetime="2026-04-29 10:21:14" /var/lib/mysql/mysql-bin.000001 | mysql
```

### Селективный возврат статусов
```sql
UPDATE cafe.orders c
INNER JOIN cafe_restore.orders cr ON c.order_id = cr.order_id
SET c.status = cr.status
WHERE c.status = 'closed' AND cr.status = 'new';
```

### Восстановление только menu_items
```sql
LOCK TABLES menu_items WRITE;
-- применить SQL с menu_items из backup
UNLOCK TABLES;
```

## 6) Сравнение логического и физического копирования
| Критерий | Логическое (mysqldump) | Физическое (xtrabackup/копия datadir) |
|---|---|---|
| Время создания | Среднее | Быстрее на больших БД |
| Размер | Обычно меньше после gzip | Ближе к физическому объёму |
| Восстановление отдельной таблицы | Очень удобно | Сложнее |
| Переносимость между версиями MySQL | Выше | Ниже |
| RPO для кафе 24/7 | 15 мин (binlog shipping) | 15 мин (с binlog) |
| RTO для кафе 24/7 | 30–90 мин | 15–45 мин |

Рекомендация: для данного масштаба кафе использовать `mysqldump + binlog` как основной метод, а `xtrabackup` как ускоренный DR-вариант.
