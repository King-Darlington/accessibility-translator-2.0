<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Include database configuration
require_once __DIR__ . '/../config/database.php';

/**
 * Enhanced utility functions for Accessibility Translator
 */

// Check if user is logged in (compatibility with session.php)
function isLoggedIn() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
}

// Get current user ID
function getUserId() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    return $_SESSION['user_id'] ?? null;
}

// Get current user data with preferences
function getCurrentUser() {
    if (!isLoggedIn()) return null;
    
    try {
        $conn = Database::getConnection();
        $userId = getUserId();
        
        $stmt = $conn->prepare("
            SELECT u.id, u.name, u.email, u.created_at, u.last_login, 
                   up.preferences_json, up.color_filter, up.tts_speed, up.tts_pitch
            FROM users u 
            LEFT JOIN user_preferences up ON u.id = up.user_id 
            WHERE u.id = ? AND u.status = 'active'
        ");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 1) {
            $user = $result->fetch_assoc();
            
            // Parse preferences from JSON or use individual columns
            if ($user['preferences_json']) {
                $user['preferences'] = json_decode($user['preferences_json'], true);
            } else {
                // Build preferences from individual columns
                $user['preferences'] = [
                    'color_filter' => $user['color_filter'] ?? 'normal',
                    'tts_speed' => $user['tts_speed'] ?? 1.0,
                    'tts_pitch' => $user['tts_pitch'] ?? 1.0,
                    'theme' => 'dark',
                    'language' => 'en'
                ];
            }
            
            return $user;
        }
    } catch (Exception $e) {
        error_log("Get current user error: " . $e->getMessage());
    }
    
    return null;
}

// Enhanced input sanitization
function sanitizeInput($data) {
    if (is_array($data)) {
        return array_map('sanitizeInput', $data);
    }
    
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return $data;
}

// Validate email with additional checks
function validateEmail($email) {
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    
    // Additional email validation
    $email = filter_var($email, FILTER_SANITIZE_EMAIL);
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

// Enhanced password hashing
function hashPassword($password) {
    return password_hash($password, PASSWORD_DEFAULT, ['cost' => 12]);
}

// Verify password with timing attack protection
function verifyPassword($password, $hash) {
    return password_verify($password, $hash);
}

// Generate secure random token
function generateToken($length = 32) {
    return bin2hex(random_bytes($length));
}

// Validate and filter user preferences
function validatePreferences($preferences) {
    $allowedPreferences = [
        'theme' => ['dark', 'light', 'auto', 'high-contrast'],
        'language' => ['en', 'es', 'fr', 'de', 'zh', 'ar'],
        'color_filter' => ['normal', 'invert', 'grayscale', 'high-contrast', 'high-contrast-black', 'high-contrast-white', 'sepia', 'dark-mode', 'blue-light', 'none'],
        'tts_speed' => 'float',
        'tts_pitch' => 'float',
        'tts_volume' => 'int',
        'auto_read' => 'bool',
        'voice_control_enabled' => 'bool',
        'offline_mode' => 'bool',
        'lazy_loading' => 'bool',
        'reduce_animations' => 'bool'
    ];
    
    $filtered = [];
    
    foreach ($preferences as $key => $value) {
        if (!isset($allowedPreferences[$key])) {
            continue; // Skip unknown preferences
        }
        
        $validation = $allowedPreferences[$key];
        
        if (is_array($validation)) {
            // Check if value is in allowed array
            if (in_array($value, $validation)) {
                $filtered[$key] = $value;
            }
        } else {
            // Type-based validation
            switch ($validation) {
                case 'float':
                    $filtered[$key] = floatval($value);
                    break;
                case 'int':
                    $filtered[$key] = intval($value);
                    break;
                case 'bool':
                    $filtered[$key] = boolval($value);
                    break;
                default:
                    $filtered[$key] = sanitizeInput($value);
            }
        }
    }
    
    return $filtered;
}

// Save user preferences to database
function saveUserPreferences($userId, $preferences) {
    try {
        $conn = Database::getConnection();
        
        // Validate preferences
        $validatedPrefs = validatePreferences($preferences);
        $preferencesJson = json_encode($validatedPrefs);
        
        // Update or insert preferences
        $stmt = $conn->prepare("
            INSERT INTO user_preferences (user_id, preferences_json, color_filter, tts_speed, tts_pitch, updated_at) 
            VALUES (?, ?, ?, ?, ?, NOW()) 
            ON DUPLICATE KEY UPDATE 
            preferences_json = VALUES(preferences_json),
            color_filter = VALUES(color_filter),
            tts_speed = VALUES(tts_speed),
            tts_pitch = VALUES(tts_pitch),
            updated_at = NOW()
        ");
        
        $colorFilter = $validatedPrefs['color_filter'] ?? 'normal';
        $ttsSpeed = $validatedPrefs['tts_speed'] ?? 1.0;
        $ttsPitch = $validatedPrefs['tts_pitch'] ?? 1.0;
        
        $stmt->bind_param("issdd", $userId, $preferencesJson, $colorFilter, $ttsSpeed, $ttsPitch);
        
        return $stmt->execute();
        
    } catch (Exception $e) {
        error_log("Save preferences error: " . $e->getMessage());
        return false;
    }
}

// Get user preferences from database
function getUserPreferences($userId) {
    try {
        $conn = Database::getConnection();
        
        $stmt = $conn->prepare("
            SELECT preferences_json, color_filter, tts_speed, tts_pitch 
            FROM user_preferences 
            WHERE user_id = ?
        ");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 1) {
            $row = $result->fetch_assoc();
            
            if ($row['preferences_json']) {
                $preferences = json_decode($row['preferences_json'], true);
            } else {
                // Fallback to individual columns
                $preferences = [
                    'color_filter' => $row['color_filter'] ?? 'normal',
                    'tts_speed' => $row['tts_speed'] ?? 1.0,
                    'tts_pitch' => $row['tts_pitch'] ?? 1.0
                ];
            }
            
            return $preferences;
        }
        
        // Return default preferences if none found
        return [
            'theme' => 'dark',
            'language' => 'en',
            'color_filter' => 'normal',
            'tts_speed' => 1.0,
            'tts_pitch' => 1.0,
            'tts_volume' => 100,
            'auto_read' => false,
            'voice_control_enabled' => true,
            'offline_mode' => true,
            'lazy_loading' => true,
            'reduce_animations' => false
        ];
        
    } catch (Exception $e) {
        error_log("Get preferences error: " . $e->getMessage());
        return [];
    }
}

// Log user activity for analytics
function logUserActivity($userId, $activity, $details = null) {
    try {
        $conn = Database::getConnection();
        
        $stmt = $conn->prepare("
            INSERT INTO usage_stats (user_id, feature_used, usage_count, details) 
            VALUES (?, ?, 1, ?) 
            ON DUPLICATE KEY UPDATE 
            usage_count = usage_count + 1,
            last_used = NOW(),
            details = ?
        ");
        
        $detailsJson = $details ? json_encode($details) : null;
        $stmt->bind_param("isss", $userId, $activity, $detailsJson, $detailsJson);
        
        $stmt->execute();
        
    } catch (Exception $e) {
        error_log("Activity logging failed: " . $e->getMessage());
    }
}

// Check if feature is enabled for user
function isFeatureEnabled($userId, $feature) {
    $preferences = getUserPreferences($userId);
    
    $featureMap = [
        'voice_control' => 'voice_control_enabled',
        'offline_mode' => 'offline_mode',
        'auto_read' => 'auto_read',
        'lazy_loading' => 'lazy_loading'
    ];
    
    $prefKey = $featureMap[$feature] ?? $feature;
    return $preferences[$prefKey] ?? true; // Default to enabled
}

// JSON response helper
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

// Error response helper
function errorResponse($message, $statusCode = 400) {
    jsonResponse(['success' => false, 'error' => $message], $statusCode);
}

// Success response helper
function successResponse($data = null, $message = null) {
    $response = ['success' => true];
    if ($message) $response['message'] = $message;
    if ($data) $response['data'] = $data;
    jsonResponse($response);
}

// Initialize session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
?>