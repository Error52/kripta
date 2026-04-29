USE cafe_orders;
DELIMITER $$

DROP TRIGGER IF EXISTS trg_order_items_before_insert $$
CREATE TRIGGER trg_order_items_before_insert
BEFORE INSERT ON order_items
FOR EACH ROW
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_available BOOLEAN;
  DECLARE v_price DECIMAL(8,2);

  SELECT status INTO v_status FROM orders WHERE order_id = NEW.order_id;
  IF v_status <> 'open' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Нельзя добавить позицию: заказ не открыт';
  END IF;

  SELECT is_available, price INTO v_available, v_price FROM menu_items WHERE item_id = NEW.item_id;
  IF v_available <> TRUE THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Блюдо недоступно';
  END IF;

  IF NEW.quantity <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Количество должно быть больше 0';
  END IF;

  IF NEW.item_price IS NULL THEN
    SET NEW.item_price = v_price;
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_order_items_after_insert $$
CREATE TRIGGER trg_order_items_after_insert
AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
  UPDATE orders o
  SET total_amount = (
    SELECT COALESCE(SUM(quantity * item_price), 0)
    FROM order_items
    WHERE order_id = NEW.order_id
  )
  WHERE o.order_id = NEW.order_id;
END $$

DROP TRIGGER IF EXISTS trg_orders_before_update $$
CREATE TRIGGER trg_orders_before_update
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
  IF OLD.status = 'open' AND NEW.status IN ('paid', 'cancelled') THEN
    IF NEW.status = 'paid' AND (NEW.payment_method IS NULL OR NEW.payment_method = '') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'При оплате обязателен способ оплаты';
    END IF;
  ELSEIF OLD.status <> NEW.status THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Недопустимый переход статуса';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_menu_items_before_update $$
CREATE TRIGGER trg_menu_items_before_update
BEFORE UPDATE ON menu_items
FOR EACH ROW
BEGIN
  DECLARE v_open_count INT DEFAULT 0;

  IF NEW.price > OLD.price * 2 OR NEW.price < OLD.price / 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Изменение цены более чем в 2 раза запрещено';
  END IF;

  IF OLD.is_available = TRUE AND NEW.is_available = FALSE THEN
    SELECT COUNT(*) INTO v_open_count
    FROM order_items oi
    JOIN orders o ON o.order_id = oi.order_id
    WHERE oi.item_id = OLD.item_id
      AND o.status = 'open';

    IF v_open_count > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Нельзя отключить блюдо: есть в открытых заказах';
    END IF;
  END IF;
END $$

DELIMITER ;
