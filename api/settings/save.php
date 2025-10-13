<?php
require_once '../../config/database.php';
require_once '../../includes/functions.php';
require_once '../../includes/session.php';
require_once '../../includes/validation.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Security headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

error_reporting(E_ALL);
ini_set('display_errors', 0);

// Rate limiting - more strict for save operations
if (!checkRateLimit('settings_save', 60, 5)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Too many save requests. Please slow down.']);
    exit;
}

// Validate session
if (!validateSession()) {
    http_response_code(401);
    echo json_encode([
        'success' => false, 
        'error' => 'Authentication required',
        'code' => 'SESSION_EXPIRED'
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

try {
    $conn = Database::getConnection();
    $userId = $_SESSION['user_id'];
    
    // Validate user exists and is active
    if (!validateUserStatus($userId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Account suspended or not found']);
        exit;
    }

    // Get and validate JSON input
    $jsonInput = file_get_contents('php://input');
    if (empty($jsonInput)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No input data provided']);
        exit;
    }

    $input = json_decode($jsonInput, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode([
            'success' => false, 
            'error' => 'Invalid JSON format: ' . json_last_error_msg()
        ]);
        exit;
    }

    if (empty($input)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No settings provided']);
        exit;
    }

    // Check payload size (limit to 50KB)
    if (strlen($jsonInput) > 50000) {
        http_response_code(413);
        echo json_encode(['success' => false, 'error' => 'Settings payload too large']);
        exit;
    }

    // Validate and sanitize settings
    $validatedSettings = validatePreferences($input);
    
    if (empty($validatedSettings)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No valid settings to save']);
        exit;
    }

    // Add metadata
    $validatedSettings['_metadata'] = [
        'last_modified' => time(),
        'modified_by' => $userId,
        'version' => '2.0',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ];

    $settingsJson = json_encode($validatedSettings, JSON_UNESCAPED_UNICODE);
    
    if ($settingsJson === false) {
        throw new Exception('Failed to encode settings to JSON');
    }

    // Start transaction for atomic operation
    $conn->begin_transaction();

    try {
        // Save to main preferences table
        $stmt = $conn->prepare("
            INSERT INTO user_preferences 
            (user_id, preferences_json, created_at, updated_at) 
            VALUES (?, ?, NOW(), NOW()) 
            ON DUPLICATE KEY UPDATE 
            preferences_json = VALUES(preferences_json),
            updated_at = NOW(),
            version = version + 1
        ");
        
        if (!$stmt) {
            throw new Exception('Database preparation failed: ' . $conn->error);
        }
        
        $stmt->bind_param("is", $userId, $settingsJson);
        
        if (!$stmt->execute()) {
            throw new Exception('Failed to execute save query: ' . $stmt->error);
        }

        // Save individual settings for backward compatibility and faster queries
        $this->saveIndividualSettings($conn, $userId, $validatedSettings);
        
        // Create settings history entry
        $this->createSettingsHistory($conn, $userId, $validatedSettings);
        
        // Commit transaction
        $conn->commit();

        // Update user last activity
        updateUserActivity($userId);

        // Log the activity with detailed info
        logUserActivity($userId, 'save_settings', [
            'settings_count' => count($validatedSettings),
            'settings_keys' => array_keys($validatedSettings),
            'data_size' => strlen($settingsJson),
            'ip' => $_SERVER['REMOTE_ADDR']
        ]);

        // Invalidate client cache
        $cacheKey = md5("user_settings_$userId");
        if (function_exists('apcu_delete')) {
            apcu_delete($cacheKey);
        }

        echo json_encode([
            'success' => true,
            'message' => 'Settings saved successfully',
            'saved_count' => count($validatedSettings),
            'timestamp' => time(),
            'metadata' => [
                'version' => '2.0',
                'size' => strlen($settingsJson)
            ]
        ], JSON_PRETTY_PRINT);

    } catch (Exception $e) {
        $conn->rollback();
        throw $e;
    }

} catch (Exception $e) {
    error_log("Settings save error for user " . ($_SESSION['user_id'] ?? 'unknown') . ": " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to save settings',
        'code' => 'SAVE_FAILED',
        'timestamp' => time()
    ]);
}

/**
 * Save individual settings for backward compatibility
 */
function saveIndividualSettings($conn, $userId, $settings) {
    $individualMappings = [
        'theme' => ['type' => 's', 'path' => 'theme'],
        'language' => ['type' => 's', 'path' => 'language'],
        'color_filter' => ['type' => 's', 'path' => 'filters.defaultFilter'],
        'tts_speed' => ['type' => 'd', 'path' => 'tts.rate'],
        'tts_pitch' => ['type' => 'd', 'path' => 'tts.pitch'],
        'tts_volume' => ['type' => 'i', 'path' => 'tts.volume'],
        'auto_read' => ['type' => 'i', 'path' => 'tts.autoRead'],
        'voice_control_enabled' => ['type' => 'i', 'path' => 'voiceControl.enabled'],
        'offline_mode' => ['type' => 'i', 'path' => 'offlineMode'],
        'lazy_loading' => ['type' => 'i', 'path' => 'performance.lazyLoading'],
        'reduce_animations' => ['type' => 'i', 'path' => 'performance.reduceAnimations']
    ];

    foreach ($individualMappings as $column => $mapping) {
        $value = getNestedValue($settings, $mapping['path']);
        if ($value !== null) {
            $updateStmt = $conn->prepare("
                INSERT INTO user_preferences (user_id, $column, updated_at) 
                VALUES (?, ?, NOW()) 
                ON DUPLICATE KEY UPDATE 
                $column = VALUES($column),
                updated_at = NOW()
            ");
            
            if ($updateStmt) {
                $updateStmt->bind_param($mapping['type'], $value, $userId);
                $updateStmt->execute();
                $updateStmt->close();
            }
        }
    }
}

/**
 * Create settings history entry
 */
function createSettingsHistory($conn, $userId, $settings) {
    $historyStmt = $conn->prepare("
        INSERT INTO user_preferences_history 
        (user_id, preferences_json, created_at) 
        VALUES (?, ?, NOW())
    ");
    
    if ($historyStmt) {
        $settingsJson = json_encode($settings, JSON_UNESCAPED_UNICODE);
        $historyStmt->bind_param("is", $userId, $settingsJson);
        $historyStmt->execute();
        $historyStmt->close();
        
        // Clean old history (keep last 10 versions)
        $cleanStmt = $conn->prepare("
            DELETE FROM user_preferences_history 
            WHERE user_id = ? AND id NOT IN (
                SELECT id FROM (
                    SELECT id FROM user_preferences_history 
                    WHERE user_id = ? 
                    ORDER BY created_at DESC 
                    LIMIT 10
                ) AS latest
            )
        ");
        $cleanStmt->bind_param("ii", $userId, $userId);
        $cleanStmt->execute();
        $cleanStmt->close();
    }
}

/**
 * Get nested value from array using dot notation
 */
function getNestedValue($array, $path) {
    $keys = explode('.', $path);
    $current = $array;
    
    foreach ($keys as $key) {
        if (!isset($current[$key])) {
            return null;
        }
        $current = $current[$key];
    }
    
    return $current;
}
?>