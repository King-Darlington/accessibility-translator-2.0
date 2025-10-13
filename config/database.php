<?php
// Database configuration with enhanced settings
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'accessibility_translator');

// Enhanced database connection with error handling and reconnection
class Database {
    private static $connection = null;
    
    public static function getConnection() {
        if (self::$connection === null || !self::$connection->ping()) {
            self::$connection = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
            
            if (self::$connection->connect_error) {
                error_log("Database connection failed: " . self::$connection->connect_error);
                throw new Exception("Database connection failed: " . self::$connection->connect_error);
            }
            
            self::$connection->set_charset("utf8mb4");
            
            // Set timezone to UTC
            self::$connection->query("SET time_zone = '+00:00'");
        }
        
        return self::$connection;
    }
    
    public static function closeConnection() {
        if (self::$connection !== null) {
            self::$connection->close();
            self::$connection = null;
        }
    }
    
    public static function isConnected() {
        return self::$connection !== null && self::$connection->ping();
    }
}

// Backward compatibility function
function getDBConnection() {
    return Database::getConnection();
}

// Test connection (optional - for debugging)
function testDatabaseConnection() {
    try {
        $conn = Database::getConnection();
        return $conn->ping();
    } catch (Exception $e) {
        error_log("Database test failed: " . $e->getMessage());
        return false;
    }
}

// Initialize database on include
try {
    Database::getConnection();
} catch (Exception $e) {
    // Log error but don't break the application
    error_log("Database initialization failed: " . $e->getMessage());
}
?>