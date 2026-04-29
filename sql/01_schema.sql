CREATE DATABASE IF NOT EXISTS cafe_orders CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cafe_orders;

CREATE TABLE menu_categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(50) NOT NULL,
  display_order INT DEFAULT 0
);

CREATE TABLE menu_items (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NULL,
  item_name VARCHAR(100) NOT NULL,
  price DECIMAL(8,2) NOT NULL,
  weight_grams INT,
  is_available BOOLEAN DEFAULT TRUE,
  CONSTRAINT fk_menu_items_category
    FOREIGN KEY (category_id)
    REFERENCES menu_categories(category_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE TABLE tables_cafe (
  table_id INT AUTO_INCREMENT PRIMARY KEY,
  table_number INT NOT NULL UNIQUE,
  seats INT,
  zone VARCHAR(30)
);

CREATE TABLE waiters (
  waiter_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  phone VARCHAR(20),
  shift VARCHAR(20)
);

CREATE TABLE orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  table_id INT NOT NULL,
  waiter_id INT NOT NULL,
  order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(20),
  CONSTRAINT fk_orders_table
    FOREIGN KEY (table_id)
    REFERENCES tables_cafe(table_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_orders_waiter
    FOREIGN KEY (waiter_id)
    REFERENCES waiters(waiter_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE TABLE order_items (
  order_item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity INT NOT NULL,
  item_price DECIMAL(8,2),
  notes VARCHAR(200),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id)
    REFERENCES orders(order_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_order_items_item
    FOREIGN KEY (item_id)
    REFERENCES menu_items(item_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  UNIQUE KEY uk_order_item_unique (order_id, item_id)
);

-- Базовые индексы (задание 5)
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_orders_date_status ON orders(order_date, status);
CREATE INDEX idx_orders_waiter ON orders(waiter_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_item ON order_items(item_id);
