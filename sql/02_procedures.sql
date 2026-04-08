USE cafe_orders;
DELIMITER $$

DROP PROCEDURE IF EXISTS OpenOrder $$
CREATE PROCEDURE OpenOrder(
  IN p_table_id INT,
  IN p_waiter_id INT,
  OUT p_order_id INT,
  OUT p_message VARCHAR(255)
)
BEGIN
  DECLARE v_exists INT DEFAULT 0;
  DECLARE v_open INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_order_id = NULL;
    SET p_message = 'Ошибка при открытии заказа';
  END;

  START TRANSACTION;

  SELECT COUNT(*) INTO v_exists FROM tables_cafe WHERE table_id = p_table_id;
  IF v_exists = 0 THEN
    SET p_order_id = NULL;
    SET p_message = 'Столик не существует';
    ROLLBACK;
  ELSE
    SELECT COUNT(*) INTO v_exists FROM waiters WHERE waiter_id = p_waiter_id;
    IF v_exists = 0 THEN
      SET p_order_id = NULL;
      SET p_message = 'Официант не существует';
      ROLLBACK;
    ELSE
      SELECT COUNT(*) INTO v_open FROM orders WHERE table_id = p_table_id AND status = 'open';
      IF v_open > 0 THEN
        SET p_order_id = NULL;
        SET p_message = 'На столике уже есть открытый заказ';
        ROLLBACK;
      ELSE
        INSERT INTO orders(table_id, waiter_id, order_date, status, total_amount)
        VALUES (p_table_id, p_waiter_id, NOW(), 'open', 0);
        SET p_order_id = LAST_INSERT_ID();
        SET p_message = 'Заказ открыт';
        COMMIT;
      END IF;
    END IF;
  END IF;
END $$

DROP PROCEDURE IF EXISTS AddToOrder $$
CREATE PROCEDURE AddToOrder(
  IN p_order_id INT,
  IN p_item_id INT,
  IN p_quantity INT,
  IN p_notes VARCHAR(200),
  OUT p_message VARCHAR(255)
)
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_price DECIMAL(8,2);
  DECLARE v_available BOOLEAN;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_message = 'Ошибка добавления позиции';
  END;

  START TRANSACTION;

  SELECT status INTO v_status FROM orders WHERE order_id = p_order_id FOR UPDATE;
  IF v_status IS NULL OR v_status <> 'open' THEN
    SET p_message = 'Заказ не найден или закрыт';
    ROLLBACK;
  ELSE
    SELECT price, is_available INTO v_price, v_available FROM menu_items WHERE item_id = p_item_id;
    IF v_price IS NULL OR v_available = FALSE THEN
      SET p_message = 'Блюдо не найдено или недоступно';
      ROLLBACK;
    ELSEIF p_quantity <= 0 THEN
      SET p_message = 'Количество должно быть больше 0';
      ROLLBACK;
    ELSE
      INSERT INTO order_items(order_id, item_id, quantity, item_price, notes)
      VALUES(p_order_id, p_item_id, p_quantity, v_price, p_notes)
      ON DUPLICATE KEY UPDATE
        quantity = quantity + VALUES(quantity),
        notes = VALUES(notes);

      UPDATE orders o
      SET total_amount = (
        SELECT COALESCE(SUM(oi.quantity * oi.item_price), 0)
        FROM order_items oi
        WHERE oi.order_id = o.order_id
      )
      WHERE o.order_id = p_order_id;

      SET p_message = 'Позиция добавлена';
      COMMIT;
    END IF;
  END IF;
END $$

DROP PROCEDURE IF EXISTS CloseOrder $$
CREATE PROCEDURE CloseOrder(
  IN p_order_id INT,
  IN p_payment_method VARCHAR(20),
  OUT p_total DECIMAL(10,2),
  OUT p_message VARCHAR(255)
)
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_count INT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_total = NULL;
    SET p_message = 'Ошибка закрытия заказа';
  END;

  START TRANSACTION;

  SELECT status INTO v_status FROM orders WHERE order_id = p_order_id FOR UPDATE;
  IF v_status IS NULL OR v_status <> 'open' THEN
    SET p_total = NULL;
    SET p_message = 'Заказ не найден или не открыт';
    ROLLBACK;
  ELSE
    SELECT COUNT(*) INTO v_count FROM order_items WHERE order_id = p_order_id;
    IF v_count = 0 THEN
      SET p_total = NULL;
      SET p_message = 'Нельзя закрыть пустой заказ';
      ROLLBACK;
    ELSE
      SELECT COALESCE(SUM(quantity * item_price), 0)
      INTO p_total
      FROM order_items
      WHERE order_id = p_order_id;

      UPDATE orders
      SET total_amount = p_total,
          payment_method = p_payment_method,
          status = 'paid'
      WHERE order_id = p_order_id;

      SET p_message = 'Заказ закрыт';
      COMMIT;
    END IF;
  END IF;
END $$

DROP PROCEDURE IF EXISTS GetShiftReport $$
CREATE PROCEDURE GetShiftReport(
  IN p_date DATE,
  IN p_shift VARCHAR(20),
  OUT p_total_revenue DECIMAL(10,2)
)
BEGIN
  SELECT
    w.waiter_id,
    CONCAT(w.first_name, ' ', w.last_name) AS waiter_name,
    o.payment_method,
    COUNT(DISTINCT o.order_id) AS orders_count,
    COALESCE(SUM(o.total_amount), 0) AS total_sum,
    COALESCE(AVG(o.total_amount), 0) AS avg_check
  FROM waiters w
  LEFT JOIN orders o
    ON o.waiter_id = w.waiter_id
   AND DATE(o.order_date) = p_date
   AND o.status = 'paid'
  WHERE w.shift = p_shift
  GROUP BY w.waiter_id, waiter_name, o.payment_method
  ORDER BY waiter_name, o.payment_method;

  SELECT COALESCE(SUM(o.total_amount), 0)
    INTO p_total_revenue
  FROM orders o
  JOIN waiters w ON w.waiter_id = o.waiter_id
  WHERE DATE(o.order_date) = p_date
    AND o.status = 'paid'
    AND w.shift = p_shift;
END $$

DROP PROCEDURE IF EXISTS QuickOrder $$
CREATE PROCEDURE QuickOrder(
  IN p_table_id INT,
  IN p_waiter_id INT,
  OUT p_order_id INT,
  OUT p_report TEXT
)
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE v_item_id INT;
  DECLARE v_quantity INT;
  DECLARE v_msg VARCHAR(255);
  DECLARE v_price DECIMAL(8,2);
  DECLARE v_available BOOLEAN;

  DECLARE cur CURSOR FOR SELECT item_id, quantity FROM tmp_quick_items;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  START TRANSACTION;
  CALL OpenOrder(p_table_id, p_waiter_id, p_order_id, v_msg);
  IF p_order_id IS NULL THEN
    SET p_report = CONCAT('Не удалось открыть заказ: ', v_msg);
    ROLLBACK;
  ELSE
    SET p_report = CONCAT('Заказ #', p_order_id, ':\n');
    OPEN cur;

    read_loop: LOOP
      FETCH cur INTO v_item_id, v_quantity;
      IF done THEN
        LEAVE read_loop;
      END IF;

      SAVEPOINT sp_item;
      SELECT price, is_available INTO v_price, v_available FROM menu_items WHERE item_id = v_item_id;
      IF v_price IS NULL OR v_available = FALSE OR v_quantity <= 0 THEN
        SET p_report = CONCAT(p_report, '- item ', v_item_id, ': пропущен\n');
        ROLLBACK TO sp_item;
      ELSE
        INSERT INTO order_items(order_id, item_id, quantity, item_price)
        VALUES(p_order_id, v_item_id, v_quantity, v_price)
        ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity);
        SET p_report = CONCAT(p_report, '- item ', v_item_id, ': добавлен\n');
      END IF;
    END LOOP;

    CLOSE cur;

    UPDATE orders o
      SET total_amount = (SELECT COALESCE(SUM(quantity * item_price), 0) FROM order_items WHERE order_id = o.order_id)
    WHERE o.order_id = p_order_id;

    COMMIT;
  END IF;
END $$

DELIMITER ;
