-- ============================================================
-- Battery CRM - Complete Database Schema
-- ============================================================

-- USERS (Admin + System Users)
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  username    VARCHAR(50) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  mobile      VARCHAR(15),
  email       VARCHAR(100),
  emp_code    VARCHAR(20),
  role        VARCHAR(20) NOT NULL DEFAULT 'admin',
  -- roles: admin, distributor, dealer, engineer_head, service_engineer, claim_return, claim_dispatch, store
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- STATES & DISTRICTS (Master)
CREATE TABLE IF NOT EXISTS states (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS districts (
  id        SERIAL PRIMARY KEY,
  state_id  INT REFERENCES states(id),
  name      VARCHAR(100) NOT NULL
);

-- DISTRIBUTORS
CREATE TABLE IF NOT EXISTS distributors (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(200) NOT NULL,
  code           VARCHAR(20) UNIQUE,
  party_code     VARCHAR(50),
  contact_person VARCHAR(100),
  mobile         VARCHAR(15),
  email          VARCHAR(100),
  gst_no         VARCHAR(20),
  pan_no         VARCHAR(15),
  address        TEXT,
  state_id       INT REFERENCES states(id),
  district_id    INT REFERENCES districts(id),
  city           VARCHAR(100),
  pincode        VARCHAR(10),
  username       VARCHAR(50),
  password_hash  VARCHAR(255),
  engineer_id    INT REFERENCES users(id),
  status         VARCHAR(20) DEFAULT 'pending',
  -- status: pending, approved, deleted
  login_active   BOOLEAN DEFAULT false,
  created_by     INT REFERENCES users(id),
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

-- DEALERS
CREATE TABLE IF NOT EXISTS dealers (
  id              SERIAL PRIMARY KEY,
  distributor_id  INT REFERENCES distributors(id),
  name            VARCHAR(200) NOT NULL,
  code            VARCHAR(20) UNIQUE,
  party_code      VARCHAR(50),
  contact_person  VARCHAR(100),
  mobile          VARCHAR(15),
  email           VARCHAR(100),
  gst_no          VARCHAR(20),
  address         TEXT,
  state_id        INT REFERENCES states(id),
  district_id     INT REFERENCES districts(id),
  city            VARCHAR(100),
  pincode         VARCHAR(10),
  username        VARCHAR(50),
  password_hash   VARCHAR(255),
  status          VARCHAR(20) DEFAULT 'pending',
  login_active    BOOLEAN DEFAULT false,
  created_by      INT REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id                   SERIAL PRIMARY KEY,
  category             VARCHAR(100) DEFAULT 'Battery',
  name                 VARCHAR(200) NOT NULL,
  code                 VARCHAR(50) UNIQUE NOT NULL,
  warranty_months      INT DEFAULT 0,
  grace_period_days    INT DEFAULT 0,
  description          TEXT,
  is_active            BOOLEAN DEFAULT true,
  created_at           TIMESTAMP DEFAULT NOW()
);

-- CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  mobile      VARCHAR(15) UNIQUE,
  email       VARCHAR(100),
  address     TEXT,
  state_id    INT REFERENCES states(id),
  district_id INT REFERENCES districts(id),
  city        VARCHAR(100),
  pincode     VARCHAR(10),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- SERIAL NUMBERS (Warranty Registration)
CREATE TABLE IF NOT EXISTS serial_numbers (
  id                SERIAL PRIMARY KEY,
  serial_no         VARCHAR(100) UNIQUE NOT NULL,
  product_id        INT REFERENCES products(id),
  dealer_id         INT REFERENCES dealers(id),
  distributor_id    INT REFERENCES distributors(id),
  party_invoice_date DATE,
  bill_to           VARCHAR(200),
  warranty_status   VARCHAR(30) DEFAULT 'pending',
  -- pending, registered
  warranty_start    DATE,
  warranty_end      DATE,
  created_by        INT REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT NOW()
);

-- SERIAL NUMBER BULK UPLOAD REQUESTS
CREATE TABLE IF NOT EXISTS serial_upload_requests (
  id             SERIAL PRIMARY KEY,
  request_no     VARCHAR(20) UNIQUE NOT NULL,
  party_name     VARCHAR(200),
  party_mobile   VARCHAR(15),
  total_items    INT DEFAULT 0,
  status         VARCHAR(20) DEFAULT 'pending',
  created_by     INT REFERENCES users(id),
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS serial_upload_items (
  id          SERIAL PRIMARY KEY,
  request_id  INT REFERENCES serial_upload_requests(id),
  serial_no   VARCHAR(100),
  product_id  INT REFERENCES products(id),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- GRACE PERIOD REQUESTS
CREATE TABLE IF NOT EXISTS grace_period_requests (
  id              SERIAL PRIMARY KEY,
  serial_no       VARCHAR(100),
  product_id      INT REFERENCES products(id),
  distributor_id  INT REFERENCES distributors(id),
  dealer_id       INT REFERENCES dealers(id),
  customer_name   VARCHAR(200),
  request_type    VARCHAR(50),
  -- Sold/Billed Battery, etc.
  reason          TEXT,
  status          VARCHAR(20) DEFAULT 'pending',
  -- pending, approved, rejected
  actioned_by     INT REFERENCES users(id),
  actioned_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- COMPLAINTS
CREATE TABLE IF NOT EXISTS complaints (
  id               SERIAL PRIMARY KEY,
  complaint_no     VARCHAR(30) UNIQUE NOT NULL,
  serial_no        VARCHAR(100),
  product_id       INT REFERENCES products(id),
  distributor_id   INT REFERENCES distributors(id),
  dealer_id        INT REFERENCES dealers(id),
  customer_id      INT REFERENCES customers(id),
  date_of_purchase DATE,
  warranty_start   DATE,
  warranty_end     DATE,
  warranty_status  VARCHAR(30),
  -- In Warranty, Out of Warranty
  complaint_remark TEXT,
  status           VARCHAR(30) DEFAULT 'pending',
  -- pending, inspection_pending, inspection_fail, battery_replaced, battery_return, closed, cancelled
  stock_action     VARCHAR(50) DEFAULT 'Action Not Performed',
  engineer_id      INT REFERENCES users(id),
  engineer_assign  BOOLEAN DEFAULT false,
  inspection_status VARCHAR(30) DEFAULT 'pending',
  inspection_result VARCHAR(30) DEFAULT 'Not Done Yet',
  dispatch_status  VARCHAR(30) DEFAULT 'pending',
  return_status    VARCHAR(30) DEFAULT 'pending',
  created_by       INT REFERENCES users(id),
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

-- COMPLAINT IMAGES
CREATE TABLE IF NOT EXISTS complaint_images (
  id            SERIAL PRIMARY KEY,
  complaint_id  INT REFERENCES complaints(id) ON DELETE CASCADE,
  image_type    VARCHAR(50),
  -- warranty_card, bill_copy, battery_image, battery_image_b
  image_url     VARCHAR(500),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- INSPECTION LOGS
CREATE TABLE IF NOT EXISTS inspection_logs (
  id               SERIAL PRIMARY KEY,
  complaint_id     INT REFERENCES complaints(id),
  engineer_id      INT REFERENCES users(id),
  inspection_date  TIMESTAMP DEFAULT NOW(),
  result           VARCHAR(30),
  -- pass, fail
  remark           TEXT,
  created_at       TIMESTAMP DEFAULT NOW()
);

-- CLAIM DISPATCH
CREATE TABLE IF NOT EXISTS claim_dispatch (
  id            SERIAL PRIMARY KEY,
  complaint_id  INT REFERENCES complaints(id),
  driver_id     INT,
  vehicle_no    VARCHAR(30),
  status        VARCHAR(20) DEFAULT 'pending',
  -- pending, gatepass, dispatched
  gatepass_no   VARCHAR(50),
  gatepass_date TIMESTAMP,
  dispatch_date TIMESTAMP,
  created_by    INT REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- CLAIM RETURN
CREATE TABLE IF NOT EXISTS claim_return (
  id            SERIAL PRIMARY KEY,
  complaint_id  INT REFERENCES complaints(id),
  status        VARCHAR(20) DEFAULT 'pending',
  -- pending, done
  return_date   TIMESTAMP,
  created_by    INT REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- RECEIVED (Physical Battery Receipt at Warehouse)
CREATE TABLE IF NOT EXISTS received_batteries (
  id                SERIAL PRIMARY KEY,
  complaint_id      INT REFERENCES complaints(id),
  serial_no         VARCHAR(100),
  receiving_by      VARCHAR(200),
  receiving_date    TIMESTAMP DEFAULT NOW(),
  warranty_start    DATE,
  warranty_end      DATE,
  warranty_status   VARCHAR(30),
  created_by        INT REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT NOW()
);

-- COUNTER REPLACEMENT
CREATE TABLE IF NOT EXISTS counter_replacements (
  id            SERIAL PRIMARY KEY,
  complaint_id  INT REFERENCES complaints(id),
  serial_no     VARCHAR(100),
  created_by    INT REFERENCES users(id),
  stock_updated BOOLEAN DEFAULT false,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- CLAIM OUTWARD
CREATE TABLE IF NOT EXISTS claim_outward (
  id            SERIAL PRIMARY KEY,
  complaint_id  INT REFERENCES complaints(id),
  dispatched    BOOLEAN DEFAULT false,
  created_by    INT REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- SCRAP LIST
CREATE TABLE IF NOT EXISTS scrap_list (
  id                    SERIAL PRIMARY KEY,
  dealer_id             INT REFERENCES dealers(id),
  distributor_id        INT REFERENCES distributors(id),
  want_to_give          INT DEFAULT 0,
  want_to_receive_virtual INT DEFAULT 0,
  want_to_receive_actual  INT DEFAULT 0,
  updated_at            TIMESTAMP DEFAULT NOW()
);

-- DRIVERS
CREATE TABLE IF NOT EXISTS drivers (
  id          SERIAL PRIMARY KEY,
  driver_id   VARCHAR(20) UNIQUE,
  name        VARCHAR(100) NOT NULL,
  mobile      VARCHAR(15),
  state_id    INT REFERENCES states(id),
  address     TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_by  INT REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- BANNERS
CREATE TABLE IF NOT EXISTS banners (
  id          SERIAL PRIMARY KEY,
  image_url   VARCHAR(500) NOT NULL,
  title       VARCHAR(200),
  is_active   BOOLEAN DEFAULT true,
  created_by  INT REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- GALLERY (Product Videos)
CREATE TABLE IF NOT EXISTS gallery (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  video_url   VARCHAR(500) NOT NULL,
  thumbnail   VARCHAR(500),
  is_active   BOOLEAN DEFAULT true,
  created_by  INT REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- MOBILE OTP (for Highflow Connect app)
CREATE TABLE IF NOT EXISTS mobile_otps (
  id         SERIAL PRIMARY KEY,
  mobile     VARCHAR(15) NOT NULL,
  otp        VARCHAR(6) NOT NULL,
  role       VARCHAR(20) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used       BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- WARRANTY REGISTRATIONS (from mobile app)
CREATE TABLE IF NOT EXISTS warranty_registrations (
  id               SERIAL PRIMARY KEY,
  serial_no        VARCHAR(100) NOT NULL,
  product_id       INT REFERENCES products(id),
  dealer_id        INT REFERENCES dealers(id),
  distributor_id   INT REFERENCES distributors(id),
  customer_id      INT REFERENCES customers(id),
  date_of_sale     DATE,
  warranty_code    VARCHAR(30) UNIQUE NOT NULL,
  warranty_start   DATE,
  warranty_end     DATE,
  status           VARCHAR(20) DEFAULT 'active',
  warranty_card_url  VARCHAR(500),
  invoice_url        VARCHAR(500),
  insurance_url      VARCHAR(500),
  created_at       TIMESTAMP DEFAULT NOW()
);

-- INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_complaints_status      ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_distributor ON complaints(distributor_id);
CREATE INDEX IF NOT EXISTS idx_complaints_dealer      ON complaints(dealer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_serial      ON complaints(serial_no);
CREATE INDEX IF NOT EXISTS idx_dealers_distributor    ON dealers(distributor_id);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_serial  ON serial_numbers(serial_no);
CREATE INDEX IF NOT EXISTS idx_claim_dispatch_status  ON claim_dispatch(status);
CREATE INDEX IF NOT EXISTS idx_claim_return_status    ON claim_return(status);
CREATE INDEX IF NOT EXISTS idx_mobile_otps_mobile     ON mobile_otps(mobile);
CREATE INDEX IF NOT EXISTS idx_warranty_reg_serial    ON warranty_registrations(serial_no);
