/*
  # Create Initial Schema for Machinery Management System

  ## 1. New Tables

  ### `users_profile`
  - `id` (uuid, primary key) - References auth.users
  - `full_name` (text) - User's full name
  - `role` (text) - User role: 'sebastian', 'eliana', 'gerencia'
  - `created_at` (timestamptz) - Record creation timestamp

  ### `machines`
  - `id` (uuid, primary key) - Machine identifier
  - `model` (text) - Machine model
  - `serial` (text, unique) - Serial number
  - `year` (integer) - Manufacturing year
  - `hours` (integer) - Operating hours
  - `drive_folder_id` (text, nullable) - Google Drive folder ID for photos
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `suppliers`
  - `id` (uuid, primary key) - Supplier identifier
  - `name` (text, unique) - Supplier name
  - `created_at` (timestamptz) - Record creation timestamp

  ### `auctions`
  - `id` (uuid, primary key) - Auction identifier
  - `machine_id` (uuid, foreign key) - References machines
  - `auction_date` (date) - Auction date
  - `lot_number` (text) - Lot number
  - `max_price` (decimal) - Maximum bidding price
  - `purchased_price` (decimal, nullable) - Final purchased price
  - `purchase_type` (text) - 'AUCTION' or 'STOCK'
  - `supplier_id` (uuid, foreign key) - References suppliers
  - `status` (text) - 'WON', 'LOST', 'PENDING'
  - `comments` (text, nullable) - Additional comments
  - `created_by` (uuid, foreign key) - References auth.users
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `purchases`
  - `id` (uuid, primary key) - Purchase identifier
  - `machine_id` (uuid, foreign key) - References machines
  - `auction_id` (uuid, foreign key, nullable) - References auctions
  - `supplier_id` (uuid, foreign key) - References suppliers
  - `invoice_date` (date) - Invoice date
  - `incoterm` (text) - Incoterm type (EXW, FOB, CIF, etc.)
  - `exw_value` (decimal) - EX Works value
  - `fob_value` (decimal) - Free On Board value
  - `disassembly_value` (decimal) - Disassembly cost
  - `usd_rate` (decimal) - USD exchange rate
  - `jpy_rate` (decimal, nullable) - JPY exchange rate
  - `trm` (decimal) - Colombian peso exchange rate
  - `port` (text) - Port of shipment
  - `shipping_type` (text) - Shipping method
  - `departure_date` (date, nullable) - Departure date
  - `estimated_arrival_date` (date, nullable) - Estimated arrival date
  - `payment_status` (text) - 'PENDING', 'PARTIAL', 'RELEASED'
  - `payment_date` (date, nullable) - Payment date
  - `created_by` (uuid, foreign key) - References auth.users
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `additional_costs`
  - `id` (uuid, primary key) - Cost identifier
  - `purchase_id` (uuid, foreign key) - References purchases
  - `concept` (text) - Cost concept (Inland, Freight, Spare Parts, etc.)
  - `amount` (decimal) - Cost amount
  - `currency` (text) - Currency (USD, COP, JPY)
  - `created_at` (timestamptz) - Record creation timestamp

  ### `management_table`
  - `id` (uuid, primary key) - Record identifier
  - `machine_id` (uuid, foreign key) - References machines
  - `auction_id` (uuid, foreign key, nullable) - References auctions
  - `purchase_id` (uuid, foreign key, nullable) - References purchases
  - `total_fob` (decimal) - Total FOB value
  - `total_cif` (decimal) - Total CIF value
  - `total_costs` (decimal) - All costs combined
  - `projected_value` (decimal, nullable) - Projected value
  - `estimated_pvp` (decimal, nullable) - Estimated public sale price
  - `sales_status` (text) - 'AVAILABLE', 'RESERVED', 'SOLD'
  - `final_comments` (text, nullable) - Management comments
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `notifications`
  - `id` (uuid, primary key) - Notification identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `type` (text) - Notification type
  - `title` (text) - Notification title
  - `message` (text) - Notification message
  - `reference_id` (uuid, nullable) - Reference to related record
  - `is_read` (boolean) - Read status
  - `created_at` (timestamptz) - Record creation timestamp

  ## 2. Security
  - Enable RLS on all tables
  - Add policies for role-based access control
*/

-- Create users_profile table
CREATE TABLE IF NOT EXISTS users_profile (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('sebastian', 'eliana', 'gerencia')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users_profile FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users_profile FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create machines table
CREATE TABLE IF NOT EXISTS machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model text NOT NULL,
  serial text UNIQUE NOT NULL,
  year integer NOT NULL,
  hours integer DEFAULT 0,
  drive_folder_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view machines"
  ON machines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert machines"
  ON machines FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update machines"
  ON machines FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create auctions table
CREATE TABLE IF NOT EXISTS auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES machines ON DELETE CASCADE,
  auction_date date NOT NULL,
  lot_number text NOT NULL,
  max_price decimal(15,2) NOT NULL,
  purchased_price decimal(15,2),
  purchase_type text NOT NULL CHECK (purchase_type IN ('AUCTION', 'STOCK')),
  supplier_id uuid NOT NULL REFERENCES suppliers ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('WON', 'LOST', 'PENDING')),
  comments text,
  created_by uuid NOT NULL REFERENCES auth.users ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view auctions"
  ON auctions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert auctions"
  ON auctions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update auctions"
  ON auctions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete auctions"
  ON auctions FOR DELETE
  TO authenticated
  USING (true);

-- Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES machines ON DELETE CASCADE,
  auction_id uuid REFERENCES auctions ON DELETE SET NULL,
  supplier_id uuid NOT NULL REFERENCES suppliers ON DELETE RESTRICT,
  invoice_date date NOT NULL,
  incoterm text NOT NULL,
  exw_value decimal(15,2) DEFAULT 0,
  fob_value decimal(15,2) DEFAULT 0,
  disassembly_value decimal(15,2) DEFAULT 0,
  usd_rate decimal(10,4) DEFAULT 1,
  jpy_rate decimal(10,4),
  trm decimal(10,2) NOT NULL,
  port text,
  shipping_type text,
  departure_date date,
  estimated_arrival_date date,
  payment_status text NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PARTIAL', 'RELEASED')),
  payment_date date,
  created_by uuid NOT NULL REFERENCES auth.users ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view purchases"
  ON purchases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert purchases"
  ON purchases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update purchases"
  ON purchases FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete purchases"
  ON purchases FOR DELETE
  TO authenticated
  USING (true);

-- Create additional_costs table
CREATE TABLE IF NOT EXISTS additional_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases ON DELETE CASCADE,
  concept text NOT NULL,
  amount decimal(15,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'COP', 'JPY')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE additional_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view additional costs"
  ON additional_costs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert additional costs"
  ON additional_costs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update additional costs"
  ON additional_costs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete additional costs"
  ON additional_costs FOR DELETE
  TO authenticated
  USING (true);

-- Create management_table
CREATE TABLE IF NOT EXISTS management_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES machines ON DELETE CASCADE,
  auction_id uuid REFERENCES auctions ON DELETE SET NULL,
  purchase_id uuid REFERENCES purchases ON DELETE SET NULL,
  total_fob decimal(15,2) DEFAULT 0,
  total_cif decimal(15,2) DEFAULT 0,
  total_costs decimal(15,2) DEFAULT 0,
  projected_value decimal(15,2),
  estimated_pvp decimal(15,2),
  sales_status text NOT NULL DEFAULT 'AVAILABLE' CHECK (sales_status IN ('AVAILABLE', 'RESERVED', 'SOLD')),
  final_comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(machine_id)
);

ALTER TABLE management_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view management table"
  ON management_table FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert management records"
  ON management_table FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update management records"
  ON management_table FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  reference_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_machines_serial ON machines(serial);
CREATE INDEX IF NOT EXISTS idx_auctions_machine_id ON auctions(machine_id);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_purchases_machine_id ON purchases(machine_id);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_status ON purchases(payment_status);
CREATE INDEX IF NOT EXISTS idx_additional_costs_purchase_id ON additional_costs(purchase_id);
CREATE INDEX IF NOT EXISTS idx_management_table_machine_id ON management_table(machine_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_machines_updated_at BEFORE UPDATE ON machines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auctions_updated_at BEFORE UPDATE ON auctions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_management_table_updated_at BEFORE UPDATE ON management_table
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();