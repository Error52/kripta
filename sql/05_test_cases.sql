USE cafe_orders;

-- Демо-данные
INSERT INTO menu_categories(category_name, display_order) VALUES
('Напитки', 1), ('Салаты', 2), ('Горячее', 3);

INSERT INTO menu_items(category_id, item_name, price, weight_grams, is_available) VALUES
(1, 'Кофе американо', 180, 250, TRUE),
(1, 'Чай зелёный', 150, 300, TRUE),
(2, 'Цезарь', 420, 320, TRUE),
(3, 'Паста карбонара', 530, 380, TRUE),
(3, 'Стейк', 1200, 400, FALSE);

INSERT INTO tables_cafe(table_number, seats, zone) VALUES
(1, 2, 'main'), (2, 4, 'main'), (3, 4, 'vip'), (4, 6, 'terrace');

INSERT INTO waiters(first_name, last_name, phone, shift) VALUES
('Анна', 'Иванова', '+79990000001', 'morning'),
('Олег', 'Смирнов', '+79990000002', 'evening');

-- 1) Открытие заказа
CALL OpenOrder(1, 1, @order_id, @msg);
SELECT @order_id AS order_id, @msg AS message;

-- 2) Добавление блюд
CALL AddToOrder(@order_id, 1, 2, 'без сахара', @msg);
SELECT @msg AS add_result_1;
CALL AddToOrder(@order_id, 3, 1, 'соус отдельно', @msg);
SELECT @msg AS add_result_2;

-- 3) Попытка добавить недоступное блюдо
CALL AddToOrder(@order_id, 5, 1, 'medium', @msg);
SELECT @msg AS add_unavailable_result;

-- 4) Закрытие заказа с оплатой
CALL CloseOrder(@order_id, 'card', @total, @msg);
SELECT @total AS total_amount, @msg AS close_result;

-- 5) Попытка недопустимого перехода статуса
UPDATE orders SET status = 'open' WHERE order_id = @order_id;

-- 6) Изменение цены > 2 раз
UPDATE menu_items SET price = price * 3 WHERE item_id = 1;

-- 7) Быстрый заказ с несколькими позициями
CREATE TEMPORARY TABLE tmp_quick_items(item_id INT, quantity INT);
INSERT INTO tmp_quick_items VALUES (1,2), (5,1), (4,1);
CALL QuickOrder(2, 1, @quick_order_id, @quick_report);
SELECT @quick_order_id AS quick_order_id, @quick_report AS quick_report;
DROP TEMPORARY TABLE tmp_quick_items;

-- 8) Отчёт за смену
CALL GetShiftReport(CURDATE(), 'morning', @shift_total);
SELECT @shift_total AS shift_total;
