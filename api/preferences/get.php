<?php
require_once '../../config/database.php';
require_once '../../includes/functions.php';
require_once '../../includes/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

error_reporting(E_ALL);
ini_set('display_errors', 1);

// Use session-based authentication
if (!validateSession()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized - Please log in']);
    exit;
}

try {
    $conn = Database::getConnection();
    $userId = $_SESSION['user_id'];

    // Get user preferences with fallback to default preferences
    $stmt = $conn->prepare("
        SELECT 
            up.color_filter, 
            up.text_size, 
            up.tts_speed, 
            up.tts_pitch, 
            up.tts_voice, 
            up.auto_speak, 
            up.high_contrast, 
            up.screen_reader_mode, 
            up.font_size, 
            up.line_height, 
            up.preferences_json,
            u.name,
            u.email,
            up.updated_at
        FROM user_preferences up
        RIGHT JOIN users u ON u.id = up.user_id
        WHERE u.id = ? AND u.status = 'active'
    ");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        // Create default preferences for user
        $defaultPreferences = [
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
            'reduce_animations' => false,
            'extension_sync' => false
        ];
        
        $preferencesJson = json_encode($defaultPreferences);
        $stmt = $conn->prepare("
            INSERT INTO user_preferences (user_id, preferences_json, color_filter, tts_speed, tts_pitch, updated_at) 
            VALUES (?, ?, 'normal', 1.0, 1.0, NOW())
        ");
        $stmt->bind_param("is", $userId, $preferencesJson);
        $stmt->execute();
        
        // Get user info
        $userStmt = $conn->prepare("SELECT name, email FROM users WHERE id = ?");
        $userStmt->bind_param("i", $userId);
        $userStmt->execute();
        $userResult = $userStmt->get_result();
        $user = $userResult->fetch_assoc();
        
        $preferences = [
            'color_filter' => 'normal',
            'text_size' => 100,
            'tts_speed' => 1.0,
            'tts_pitch' => 1.0,
            'tts_voice' => '',
            'auto_speak' => false,
            'high_contrast' => false,
            'screen_reader_mode' => false,
            'font_size' => 16,
            'line_height' => 1.5,
            'preferences_json' => $defaultPreferences,
            'user' => $user
        ];
    } else {
        $preferences = $result->fetch_assoc();
        
        // Decode JSON preferences if exists
        if ($preferences['preferences_json']) {
            $preferences['preferences_json'] = json_decode($preferences['preferences_json'], true);
        } else {
            // Create default JSON preferences from individual columns
            $preferences['preferences_json'] = [
                'theme' => 'dark',
                'language' => 'en',
                'color_filter' => $preferences['color_filter'] ?? 'normal',
                'tts_speed' => $preferences['tts_speed'] ?? 1.0,
                'tts_pitch' => $preferences['tts_pitch'] ?? 1.0,
                'tts_volume' => 100,
                'auto_read' => $preferences['auto_speak'] ?? false,
                'voice_control_enabled' => true,
                'offline_mode' => true
            ];
        }
        
        // Get user info
        $preferences['user'] = [
            'name' => $preferences['name'],
            'email' => $preferences['email']
        ];
        unset($preferences['name'], $preferences['email']);
    }

    // Log the preferences retrieval
    logUserActivity($userId, 'get_preferences', ['source' => 'settings_page']);

    echo json_encode([
        'success' => true,
        'preferences' => $preferences,
        'timestamp' => time()
    ]);

} catch (Exception $e) {
    error_log("Preferences get error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to retrieve preferences',
        'debug' => $e->getMessage()
    ]);
}
?>