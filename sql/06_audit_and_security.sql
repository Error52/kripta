CREATE DATABASE IF NOT EXISTS cafe CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cafe;

-- Базовые таблицы (минимально необходимые для задания аудита)
CREATE TABLE IF NOT EXISTS menu_items (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NULL,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS `tables` (
  table_id INT AUTO_INCREMENT PRIMARY KEY,
  table_number INT UNIQUE,
  status VARCHAR(20) DEFAULT 'free'
);

CREATE TABLE IF NOT EXISTS waiters (
  waiter_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  shift VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  table_id INT NOT NULL,
  waiter_id INT NOT NULL,
  order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount DECIMAL(5,2) NOT NULL DEFAULT 0,
  cancellation_reason VARCHAR(255) NULL,
  tip_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_orders_table FOREIGN KEY (table_id) REFERENCES `tables`(table_id),
  CONSTRAINT fk_orders_waiter FOREIGN KEY (waiter_id) REFERENCES waiters(waiter_id)
);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity INT NOT NULL,
  item_price DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
  CONSTRAINT fk_oi_item FOREIGN KEY (item_id) REFERENCES menu_items(item_id)
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method VARCHAR(20) NOT NULL,
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(64) NOT NULL,
  operation ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  row_id BIGINT NOT NULL,
  field_name VARCHAR(64) NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  business_context VARCHAR(100) NULL,
  changed_by VARCHAR(128) NOT NULL DEFAULT (CURRENT_USER()),
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  shift_id VARCHAR(64) NULL,
  workstation VARCHAR(100) NULL
);

CREATE INDEX idx_audit_table_time ON audit_log(table_name, changed_at);
CREATE INDEX idx_audit_user_time ON audit_log(changed_by, changed_at);

DELIMITER $$

DROP TRIGGER IF EXISTS trg_orders_after_insert_audit $$
CREATE TRIGGER trg_orders_after_insert_audit
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
  INSERT INTO audit_log(table_name, operation, row_id, field_name, old_value, new_value, business_context, shift_id, workstation)
  VALUES ('orders', 'INSERT', NEW.order_id, 'lifecycle', NULL,
          CONCAT('open: table=', NEW.table_id, ', waiter=', NEW.waiter_id, ', created=', NEW.order_date),
          'ORDER_OPENED', @current_shift, @workstation);
END $$

DROP TRIGGER IF EXISTS trg_orders_before_update_protect_paid $$
CREATE TRIGGER trg_orders_before_update_protect_paid
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
  IF OLD.status = 'paid' AND (
      NEW.total_amount <> OLD.total_amount OR
      NEW.discount <> OLD.discount
  ) THEN
    INSERT INTO audit_log(table_name, operation, row_id, field_name, old_value, new_value, business_context, shift_id, workstation)
    VALUES ('orders', 'UPDATE', OLD.order_id, 'fraud_protection',
            CONCAT('status=', OLD.status, '; total=', OLD.total_amount, '; discount=', OLD.discount),
            CONCAT('status=', NEW.status, '; total=', NEW.total_amount, '; discount=', NEW.discount),
            'FRAUD_ATTEMPT', @current_shift, @workstation);
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Запрещено менять total_amount/discount у оплаченного заказа';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_orders_after_update_audit $$
CREATE TRIGGER trg_orders_after_update_audit
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO audit_log(table_name, operation, row_id, field_name, old_value, new_value, business_context, shift_id, workstation)
    VALUES ('orders', 'UPDATE', NEW.order_id, 'status', OLD.status, NEW.status, 'ORDER_STATUS_TRANSITION', @current_shift, @workstation);
  END IF;

  IF OLD.total_amount <> NEW.total_amount THEN
    INSERT INTO audit_log(table_name, operation, row_id, field_name, old_value, new_value, business_context, shift_id, workstation)
    VALUES ('orders', 'UPDATE', NEW.order_id, 'total_amount', OLD.total_amount, NEW.total_amount, 'ORDER_AMOUNT_CHANGED', @current_shift, @workstation);
  END IF;

  IF OLD.discount <> NEW.discount THEN
    INSERT INTO audit_log(table_name, operation, row_id, field_name, old_value, new_value, business_context, shift_id, workstation)
    VALUES ('orders', 'UPDATE', NEW.order_id, 'discount', OLD.discount, NEW.discount, 'DISCOUNT_CHANGED', @current_shift, @workstation);
  END IF;

  IF OLD.waiter_id <> NEW.waiter_id THEN
    INSERT INTO audit_log(table_name, operation, row_id, field_name, old_value, new_value, business_context, shift_id, workstation)
    VALUES ('orders', 'UPDATE', NEW.order_id, 'waiter_id', OLD.waiter_id, NEW.waiter_id, 'WAITER_REASSIGN', @current_shift, @workstation);
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_orders_before_delete_block $$
CREATE TRIGGER trg_orders_before_delete_block
BEFORE DELETE ON orders
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Удаление заказов запрещено. Используйте статус cancelled';
END $$

DROP TRIGGER IF EXISTS trg_menu_items_after_insert_audit $$
CREATE TRIGGER trg_menu_items_after_insert_audit
AFTER INSERT ON menu_items
FOR EACH ROW
BEGIN
  INSERT INTO audit_log(table_name, operation, row_id, field_name, old_value, new_value, business_context, shift_id, workstation)
  VALUES ('menu_items', 'INSERT', NEW.item_id, 'menu_item', NULL,
          CONCAT('name=', NEW.name, ', price=', NEW.price, ', available=', NEW.is_available, ', category=', NEW.category_id),
          'MENU_ITEM_CREATED', @current_shift, @workstation);
END $$

DROP TRIGGER IF EXISTS trg_menu_items_after_update_audit $$
CREATE TRIGGER trg_menu_items_after_update_audit
AFTER UPDATE ON menu_items
FOR EACH ROW
BEGIN
  DECLARE pct_change DECIMAL(10,2);

  IF OLD.price <> NEW.price THEN
    INSERT INTO audit_log(table_name, operation, row_id, field_name, old_value, new_value, business_context, shift_id, workstation)
    VALUES ('menu_items', 'UPDATE', NEW.item_id, 'price', OLD.price, NEW.price, 'MENU_PRICE_CHANGE', @current_shift, @workstation);

    IF OLD.price > 0 THEN
      SET pct_change = ABS((NEW.price - OLD.price) / OLD.price) * 100;
      IF pct_change > 25 THEN
        INSERT INTO audit_log(table_name, operation, row_id, field_name, old_value, new_value, business_context, shift_id, workstation)
        VALUES ('menu_items', 'UPDATE', NEW.item_id, 'price', OLD.price,
                CONCAT(NEW.price, ' (', ROUND(pct_change,2), '%)'),
                'MENU_PRICE_ANOMALY', @current_shift, @workstation);
      END IF;
    END IF;
  END IF;

  IF OLD.name <> NEW.name THEN
    INSERT INTO audit_log(table_name, operation, row_id, field_name, old_value, new_value, business_context, shift_id, workstation)
    VALUES ('menu_items', 'UPDATE', NEW.item_id, 'name', OLD.name, NEW.name, 'MENU_NAME_CHANGE', @current_shift, @workstation);
  END IF;

  IF OLD.is_available <> NEW.is_available THEN
    INSERT INTO audit_log(table_name, operation, row_id, field_name, old_value, new_value, business_context, shift_id, workstation)
    VALUES ('menu_items', 'UPDATE', NEW.item_id, 'is_available', OLD.is_available, NEW.is_available, 'MENU_AVAILABILITY_CHANGE', @current_shift, @workstation);
  END IF;

  IF IFNULL(OLD.category_id,-1) <> IFNULL(NEW.category_id,-1) THEN
    INSERT INTO audit_log(table_name, operation, row_id, field_name, old_value, new_value, business_context, shift_id, workstation)
    VALUES ('menu_items', 'UPDATE', NEW.item_id, 'category_id', OLD.category_id, NEW.category_id, 'MENU_CATEGORY_CHANGE', @current_shift, @workstation);
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_menu_items_after_delete_audit $$
CREATE TRIGGER trg_menu_items_after_delete_audit
AFTER DELETE ON menu_items
FOR EACH ROW
BEGIN
  INSERT INTO audit_log(table_name, operation, row_id, field_name, old_value, new_value, business_context, shift_id, workstation)
  VALUES ('menu_items', 'DELETE', OLD.item_id, 'menu_item',
          CONCAT('name=', OLD.name, ', price=', OLD.price), NULL,
          'MENU_ITEM_REMOVED', @current_shift, @workstation);
END $$

DROP TRIGGER IF EXISTS trg_order_items_after_insert_audit $$
CREATE TRIGGER trg_order_items_after_insert_audit
AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
  INSERT INTO audit_log(table_name, operation, row_id, field_name, old_value, new_value, business_context, shift_id, workstation)
  VALUES ('order_items', 'INSERT', NEW.order_item_id, 'item_add', NULL,
          CONCAT('order=', NEW.order_id, ', item=', NEW.item_id, ', qty=', NEW.quantity, ', price=', NEW.item_price),
          'ORDER_ITEM_ADDED', @current_shift, @workstation);
END $$

DROP TRIGGER IF EXISTS trg_order_items_after_delete_audit $$
CREATE TRIGGER trg_order_items_after_delete_audit
AFTER DELETE ON order_items
FOR EACH ROW
BEGIN
  INSERT INTO audit_log(table_name, operation, row_id, field_name, old_value, new_value, business_context, shift_id, workstation)
  VALUES ('order_items', 'DELETE', OLD.order_item_id, 'item_remove',
          CONCAT('order=', OLD.order_id, ', item=', OLD.item_id, ', qty=', OLD.quantity), NULL,
          'ORDER_ITEM_REMOVED', @current_shift, @workstation);
END $$

DELIMITER ;

-- Включение general_log в таблицу (для среды demo):
-- SET GLOBAL log_output = 'TABLE';
-- SET GLOBAL general_log = 'ON';

-- Пользователь аудитора и права
CREATE USER IF NOT EXISTS 'cafe_supervisor'@'%' IDENTIFIED BY 'StrongTempPass_ChangeMe1!';
GRANT SELECT ON cafe.audit_log TO 'cafe_supervisor'@'%';
GRANT SELECT ON mysql.general_log TO 'cafe_supervisor'@'%';

-- Представления аудитора
CREATE OR REPLACE VIEW v_waiter_activity AS
SELECT
  w.waiter_id,
  CONCAT(w.first_name, ' ', w.last_name) AS waiter_name,
  COUNT(o.order_id) AS orders_count,
  AVG(o.total_amount) AS avg_check,
  SUM(o.tip_amount) AS total_tips,
  SUM(CASE WHEN o.discount > 0 THEN 1 ELSE 0 END) AS discounted_orders
FROM waiters w
LEFT JOIN orders o ON o.waiter_id = w.waiter_id
GROUP BY w.waiter_id, waiter_name;

CREATE OR REPLACE VIEW v_price_changes AS
SELECT *
FROM audit_log
WHERE table_name = 'menu_items'
  AND field_name = 'price'
ORDER BY changed_at DESC;

CREATE OR REPLACE VIEW v_discount_abuse AS
SELECT
  o.waiter_id,
  CONCAT(w.first_name, ' ', w.last_name) AS waiter_name,
  SUM(CASE WHEN o.discount >= 20 THEN 1 ELSE 0 END) AS max_discount_orders,
  COUNT(*) AS total_orders,
  ROUND(100 * SUM(CASE WHEN o.discount >= 20 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 2) AS ratio_pct
FROM orders o
JOIN waiters w ON w.waiter_id = o.waiter_id
GROUP BY o.waiter_id, waiter_name
HAVING ratio_pct > 30;

CREATE OR REPLACE VIEW v_cancelled_orders AS
SELECT
  o.order_id,
  o.order_date,
  o.table_id,
  o.waiter_id,
  o.cancellation_reason,
  o.total_amount
FROM orders o
WHERE o.status = 'cancelled';
