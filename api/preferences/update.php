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
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
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

    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON input');
    }

    // Initialize updates
    $updates = [];
    $types = "";
    $values = [];
    $preferencesJson = null;

    // Handle individual field updates (legacy support)
    $individualFields = [
        'color_filter' => ['type' => 's', 'column' => 'color_filter'],
        'text_size' => ['type' => 'i', 'column' => 'text_size'],
        'tts_speed' => ['type' => 'd', 'column' => 'tts_speed'],
        'tts_pitch' => ['type' => 'd', 'column' => 'tts_pitch'],
        'tts_voice' => ['type' => 's', 'column' => 'tts_voice'],
        'font_size' => ['type' => 'i', 'column' => 'font_size'],
        'line_height' => ['type' => 'd', 'column' => 'line_height']
    ];

    foreach ($individualFields as $field => $config) {
        if (isset($input[$field])) {
            $updates[] = "{$config['column']} = ?";
            $types .= $config['type'];
            $values[] = $input[$field];
        }
    }

    // Handle boolean fields
    $booleanFields = [
        'auto_speak' => 'auto_speak',
        'high_contrast' => 'high_contrast',
        'screen_reader_mode' => 'screen_reader_mode'
    ];

    foreach ($booleanFields as $field => $column) {
        if (isset($input[$field])) {
            $updates[] = "$column = ?";
            $types .= "i";
            $values[] = $input[$field] ? 1 : 0;
        }
    }

    // Handle preferences_json (new settings system)
    if (isset($input['preferences_json'])) {
        $preferencesData = $input['preferences_json'];
        
        // Validate preferences
        $validatedPreferences = validatePreferences($preferencesData);
        $preferencesJson = json_encode($validatedPreferences);
        
        $updates[] = "preferences_json = ?";
        $types .= "s";
        $values[] = $preferencesJson;

        // Also update individual columns from preferences_json for backward compatibility
        if (isset($validatedPreferences['color_filter'])) {
            $updates[] = "color_filter = ?";
            $types .= "s";
            $values[] = $validatedPreferences['color_filter'];
        }
        
        if (isset($validatedPreferences['tts_speed'])) {
            $updates[] = "tts_speed = ?";
            $types .= "d";
            $values[] = $validatedPreferences['tts_speed'];
        }
        
        if (isset($validatedPreferences['tts_pitch'])) {
            $updates[] = "tts_pitch = ?";
            $types .= "d";
            $values[] = $validatedPreferences['tts_pitch'];
        }
        
        if (isset($validatedPreferences['auto_read'])) {
            $updates[] = "auto_speak = ?";
            $types .= "i";
            $values[] = $validatedPreferences['auto_read'] ? 1 : 0;
        }
    }

    if (empty($updates)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No preferences to update']);
        exit;
    }

    // Add updated_at and user_id
    $updates[] = "updated_at = NOW()";
    $types .= "i";
    $values[] = $userId;

    // Build and execute query
    $sql = "INSERT INTO user_preferences (user_id, " . 
           str_replace(' = ?', '', implode(", ", array_slice($updates, 0, -1))) . 
           ") VALUES (?" . str_repeat(", ?", count($values) - 1) . ") " .
           "ON DUPLICATE KEY UPDATE " . implode(", ", $updates);
    
    $stmt = $conn->prepare($sql);
    
    if (!$stmt) {
        throw new Exception('Failed to prepare statement: ' . $conn->error);
    }

    $stmt->bind_param($types, ...$values);
    
    if ($stmt->execute()) {
        // Log the update activity
        $updateDetails = [
            'fields_updated' => count($updates) - 1, // exclude updated_at
            'has_json' => !is_null($preferencesJson)
        ];
        logUserActivity($userId, 'update_preferences', $updateDetails);

        echo json_encode([
            'success' => true,
            'message' => 'Preferences updated successfully',
            'updated_fields' => count($updates) - 1,
            'timestamp' => time()
        ]);
    } else {
        throw new Exception('Database execution failed: ' . $stmt->error);
    }

} catch (Exception $e) {
    error_log("Preferences update error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to update preferences',
        'debug' => $e->getMessage()
    ]);
}
?>