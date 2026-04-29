USE cafe_orders;

-- Запрос 1: выручка по официантам за дату
EXPLAIN FORMAT=TRADITIONAL
SELECT w.waiter_id, w.first_name, w.last_name,
       o.payment_method,
       SUM(o.total_amount) AS revenue
FROM waiters w
LEFT JOIN orders o ON o.waiter_id = w.waiter_id
WHERE DATE(o.order_date) = '2026-04-08'
  AND o.status = 'paid'
GROUP BY w.waiter_id, w.first_name, w.last_name, o.payment_method;

-- Запрос 2: ТОП блюд за период
EXPLAIN FORMAT=TRADITIONAL
SELECT mi.item_id, mi.item_name,
       SUM(oi.quantity) AS total_qty,
       SUM(oi.quantity * oi.item_price) AS total_sales
FROM order_items oi
JOIN orders o ON o.order_id = oi.order_id
JOIN menu_items mi ON mi.item_id = oi.item_id
WHERE o.order_date BETWEEN '2026-04-01' AND '2026-04-08 23:59:59'
  AND o.status = 'paid'
GROUP BY mi.item_id, mi.item_name
ORDER BY total_qty DESC
LIMIT 10;

-- Запрос 3: средний чек по зонам/дням недели
EXPLAIN FORMAT=TRADITIONAL
SELECT t.zone,
       DAYNAME(o.order_date) AS week_day,
       AVG(o.total_amount) AS avg_check
FROM orders o
JOIN tables_cafe t ON t.table_id = o.table_id
WHERE o.status = 'paid'
GROUP BY t.zone, DAYNAME(o.order_date)
ORDER BY t.zone, week_day;

-- Сводка сравнения до/после индексов оформляется так:
-- | Запрос | До индексов | После индексов |
-- |--------|-------------|----------------|
-- | Выручка по официантам | full scan orders | range idx_orders_date_status + ref idx_orders_waiter |
-- | ТОП блюд | full scan order_items/orders | ref idx_order_items_order + range idx_orders_date_status |
-- | Средний чек | full scan orders | ref idx_orders_date_status + ref fk_orders_table |
