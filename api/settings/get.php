<?php
require_once '../../config/database.php';
require_once '../../includes/functions.php';
require_once '../../includes/session.php';
require_once '../../includes/validation.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, OPTIONS');
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
ini_set('display_errors', 0); // Disable in production

// Rate limiting
if (!checkRateLimit('settings_get', 60, 10)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Too many requests. Please try again later.']);
    exit;
}

try {
    // Validate session and CSRF token for state-changing operations
    if (!validateSession()) {
        http_response_code(401);
        echo json_encode([
            'success' => false, 
            'error' => 'Authentication required',
            'code' => 'SESSION_EXPIRED'
        ]);
        exit;
    }

    $conn = Database::getConnection();
    $userId = $_SESSION['user_id'];
    
    // Validate user exists and is active
    if (!validateUserStatus($userId)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Account suspended or not found']);
        exit;
    }

    // Get user settings from preferences with enhanced query
    $stmt = $conn->prepare("
        SELECT 
            up.preferences_json,
            up.created_at as preferences_created,
            up.updated_at as preferences_updated,
            u.name,
            u.email,
            u.role,
            u.created_at as user_created,
            u.last_login,
            u.is_active
        FROM user_preferences up
        RIGHT JOIN users u ON u.id = up.user_id
        WHERE u.id = ? AND u.is_active = 1
    ");
    
    if (!$stmt) {
        throw new Exception('Database preparation failed: ' . $conn->error);
    }
    
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found']);
        exit;
    }

    $row = $result->fetch_assoc();
    $settings = [];
    $userInfo = [
        'name' => $row['name'],
        'email' => $row['email'],
        'role' => $row['role'],
        'created_at' => $row['user_created'],
        'last_login' => $row['last_login']
    ];
    
    // Parse settings with validation
    if ($row['preferences_json']) {
        $settings = json_decode($row['preferences_json'], true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("Invalid JSON in preferences for user $userId: " . json_last_error_msg());
            $settings = []; // Reset to defaults if corrupted
        }
    }

    // Apply default settings if empty or invalid
    if (empty($settings) || !is_array($settings)) {
        $settings = getDefaultSettings();
        
        // Auto-save defaults if no settings exist
        $defaultsJson = json_encode($settings);
        $saveStmt = $conn->prepare("
            INSERT INTO user_preferences (user_id, preferences_json, created_at, updated_at) 
            VALUES (?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE preferences_json = VALUES(preferences_json)
        ");
        $saveStmt->bind_param("is", $userId, $defaultsJson);
        $saveStmt->execute();
    }

    // Sanitize settings before output
    $settings = sanitizeSettings($settings);

    // Get extension sync status if available
    $extensionStatus = getExtensionSyncStatus($userId);

    // Log the activity with IP and user agent
    logUserActivity($userId, 'get_settings', [
        'source' => 'settings_api',
        'ip' => $_SERVER['REMOTE_ADDR'],
        'user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
        'settings_count' => count($settings)
    ]);

    // Prepare response with cache headers
    $lastModified = strtotime($row['preferences_updated'] ?? $row['user_created']);
    $etag = md5(serialize($settings) . $lastModified);
    
    header('ETag: ' . $etag);
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $lastModified) . ' GMT');
    
    // Check client cache
    if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && $_SERVER['HTTP_IF_NONE_MATCH'] === $etag) {
        http_response_code(304);
        exit;
    }

    echo json_encode([
        'success' => true,
        'settings' => $settings,
        'user' => $userInfo,
        'metadata' => [
            'version' => '2.0',
            'last_modified' => $lastModified,
            'cache_key' => $etag,
            'extension_sync' => $extensionStatus
        ],
        'timestamp' => time()
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Settings get error for user " . ($_SESSION['user_id'] ?? 'unknown') . ": " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to retrieve settings',
        'code' => 'INTERNAL_ERROR',
        'timestamp' => time()
    ]);
}

/**
 * Get default settings structure
 */
function getDefaultSettings() {
    return [
        'profile' => [
            'displayName' => '',
            'email' => '',
            'emailNotifications' => true,
            'avatar' => '',
            'lastActive' => time()
        ],
        'theme' => 'dark',
        'language' => 'en',
        'autoStart' => false,
        'offlineMode' => true,
        'tts' => [
            'voice' => '',
            'rate' => 1.0,
            'pitch' => 1.0,
            'volume' => 100,
            'autoRead' => false,
            'highlightText' => true,
            'preferredVoices' => []
        ],
        'voiceControl' => [
            'enabled' => true,
            'language' => 'en-US',
            'feedback' => true,
            'sensitivity' => 0.5,
            'commands' => []
        ],
        'filters' => [
            'defaultFilter' => 'none',
            'rememberFilter' => true,
            'autoContrast' => false,
            'colorBlindMode' => 'none',
            'fontSize' => 'medium'
        ],
        'performance' => [
            'cacheSize' => 50,
            'lazyLoading' => true,
            'reduceAnimations' => false,
            'hardwareAcceleration' => true,
            'backgroundThrottling' => false,
            'autoSave' => true
        ],
        'privacy' => [
            'dataCollection' => false,
            'analytics' => false,
            'crashReports' => false,
            'telemetry' => false
        ],
        'extension' => [
            'sync' => false,
            'autoUpdate' => true,
            'permissions' => []
        ],
        'shortcuts' => [
            'toggleTTS' => 'Ctrl+Shift+S',
            'toggleVoiceControl' => 'Ctrl+Shift+V',
            'quickSettings' => 'Ctrl+Shift+Q'
        ],
        'version' => '2.0',
        'created' => time()
    ];
}

/**
 * Sanitize settings before output
 */
function sanitizeSettings($settings) {
    // Remove sensitive data
    unset($settings['password'], $settings['token'], $settings['api_key']);
    
    // Ensure required structure
    if (!isset($settings['version'])) {
        $settings['version'] = '1.0';
    }
    
    return $settings;
}

/**
 * Get extension sync status
 */
function getExtensionSyncStatus($userId) {
    // Implementation depends on your extension system
    return [
        'connected' => false,
        'last_sync' => null,
        'version' => null
    ];
}
?>