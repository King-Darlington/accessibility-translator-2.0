-- Create the database
CREATE DATABASE IF NOT EXISTS accessibility_translator CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE accessibility_translator;

-- Users table with enhanced fields
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    profile_picture VARCHAR(500) NULL,
    phone VARCHAR(20) NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    INDEX idx_email (email),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Enhanced User preferences table
CREATE TABLE user_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    
    -- Legacy fields for backward compatibility
    color_filter VARCHAR(50) DEFAULT 'normal',
    text_size INT DEFAULT 100,
    tts_speed DECIMAL(3,1) DEFAULT 1.0,
    tts_pitch DECIMAL(3,1) DEFAULT 1.0,
    tts_voice VARCHAR(100) NULL,
    auto_speak BOOLEAN DEFAULT FALSE,
    high_contrast BOOLEAN DEFAULT FALSE,
    screen_reader_mode BOOLEAN DEFAULT FALSE,
    font_size INT DEFAULT 16,
    line_height DECIMAL(3,1) DEFAULT 1.5,
    
    -- New enhanced preferences (JSON format)
    preferences_json LONGTEXT NULL,
    
    -- Offline and sync fields
    last_sync TIMESTAMP NULL,
    offline_data LONGTEXT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_pref (user_id),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Enhanced Usage statistics table
CREATE TABLE usage_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    feature_used VARCHAR(100) NOT NULL,
    usage_count INT DEFAULT 1,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    details JSON NULL, -- Store additional usage data
    device_info VARCHAR(255) NULL,
    session_id VARCHAR(255) NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_feature (user_id, feature_used),
    INDEX idx_user_feature (user_id, feature_used),
    INDEX idx_last_used (last_used),
    INDEX idx_feature_used (feature_used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Enhanced Sessions table
CREATE TABLE sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    device_type ENUM('desktop', 'tablet', 'mobile', 'unknown') DEFAULT 'unknown',
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_last_activity (last_activity),
    INDEX idx_expires_at (expires_at),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- New User Activity Log table
CREATE TABLE user_activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    activity_type VARCHAR(100) NOT NULL,
    activity_details JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_activity_type (activity_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- New Extension Sync table
CREATE TABLE extension_sync_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    extension_id VARCHAR(255) NOT NULL,
    sync_action ENUM('export', 'import', 'sync') NOT NULL,
    data_size INT NULL,
    sync_status ENUM('success', 'failed', 'pending') DEFAULT 'pending',
    sync_details JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_extension_id (extension_id),
    INDEX idx_sync_status (sync_status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- New Offline Cache table
CREATE TABLE offline_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    cache_key VARCHAR(255) NOT NULL,
    cache_data LONGTEXT NOT NULL,
    cache_type ENUM('settings', 'preferences', 'content', 'other') DEFAULT 'other',
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_cache (user_id, cache_key),
    INDEX idx_user_id (user_id),
    INDEX idx_cache_key (cache_key),
    INDEX idx_cache_type (cache_type),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default system settings
INSERT INTO user_preferences (user_id, preferences_json) 
VALUES (0, '{
    "system": {
        "default_theme": "dark",
        "default_language": "en",
        "maintenance_mode": false,
        "allow_registration": true,
        "max_file_size": 10485760,
        "session_timeout": 86400
    },
    "features": {
        "voice_control": true,
        "offline_mode": true,
        "extension_sync": true,
        "analytics": true
    }
}');

-- Create initial admin user (optional - remove password before production)
-- INSERT INTO users (name, email, password, status) 
-- VALUES ('Admin User', 'admin@accessibilitytranslator.com', '$2y$12$hashedpassword', 'active');

-- Create indexes for better performance
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login);
CREATE INDEX idx_preferences_updated ON user_preferences(updated_at);
CREATE INDEX idx_activity_logs_composite ON user_activity_logs(user_id, created_at);
CREATE INDEX idx_offline_cache_composite ON offline_cache(user_id, cache_type);

-- Create views for common queries
CREATE VIEW user_settings_summary AS
SELECT 
    u.id as user_id,
    u.name,
    u.email,
    u.last_login,
    up.preferences_json,
    up.updated_at as last_settings_update,
    (SELECT COUNT(*) FROM usage_stats us WHERE us.user_id = u.id) as total_features_used,
    (SELECT MAX(last_used) FROM usage_stats us WHERE us.user_id = u.id) as last_feature_used
FROM users u
LEFT JOIN user_preferences up ON u.id = up.user_id
WHERE u.status = 'active';

-- Create stored procedure for cleaning old data
DELIMITER //
CREATE PROCEDURE CleanOldData(IN days_old INT)
BEGIN
    -- Clean old sessions
    DELETE FROM sessions WHERE last_activity < DATE_SUB(NOW(), INTERVAL days_old DAY);
    
    -- Clean old activity logs (keep 90 days by default)
    DELETE FROM user_activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL days_old DAY);
    
    -- Clean expired offline cache
    DELETE FROM offline_cache WHERE expires_at < NOW();
    
    -- Clean old sync logs (keep 30 days)
    DELETE FROM extension_sync_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
END//
DELIMITER ;

-- Create trigger to update user timestamp on preference changes
DELIMITER //
CREATE TRIGGER before_preferences_update 
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
    
    -- Update last_sync timestamp if preferences_json changes
    IF NEW.preferences_json != OLD.preferences_json THEN
        SET NEW.last_sync = CURRENT_TIMESTAMP;
    END IF;
END//
DELIMITER ;

-- Create event for automatic data cleanup (runs daily)
DELIMITER //
CREATE EVENT IF NOT EXISTS daily_cleanup
ON SCHEDULE EVERY 1 DAY
DO
BEGIN
    CALL CleanOldData(90); -- Clean data older than 90 days
END//
DELIMITER ;

-- Enable event scheduler
SET GLOBAL event_scheduler = ON;