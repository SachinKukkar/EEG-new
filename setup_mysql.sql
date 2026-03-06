-- Run this file in MySQL Workbench or MySQL Command Line

-- Drop existing user if exists
DROP USER IF EXISTS 'eeg_user'@'localhost';

-- Create database
CREATE DATABASE IF NOT EXISTS eeg_biometric;

-- Create user with password
CREATE USER 'eeg_user'@'localhost' IDENTIFIED BY '5911';

-- Grant privileges
GRANT ALL PRIVILEGES ON eeg_biometric.* TO 'eeg_user'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Verify
SELECT user, host FROM mysql.user WHERE user = 'eeg_user';
