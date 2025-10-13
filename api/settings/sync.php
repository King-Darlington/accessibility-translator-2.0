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

// Rate limiting for sync operations
if (!checkRateLimit('settings_sync', 60, 15)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Too many sync requests. Please try again later.']);
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

    // Get JSON input
    $jsonInput = file_get_contents('php://input');
    $input = json_decode($jsonInput, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON input: ' . json_last_error_msg());
    }

    $action = $input['action'] ?? 'sync';
    $source = $input['source'] ?? 'unknown';
    $deviceId = $input['device_id'] ?? 'unknown';
    $clientVersion = $input['client_version'] ?? 'unknown';

    // Validate action
    $allowedActions = ['export', 'import', 'sync', 'status', 'resolve_conflict'];
    if (!in_array($action, $allowedActions)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid action specified']);
        exit;
    }

    switch ($action) {
        case 'export':
            $result = handleExport($conn, $userId, $source, $deviceId, $clientVersion);
            break;

        case 'import':
            $result = handleImport($conn, $userId, $input, $source, $deviceId, $clientVersion);
            break;

        case 'resolve_conflict':
            $result = handleConflictResolution($conn, $userId, $input, $source, $deviceId);
            break;

        case 'status':
            $result = handleStatus($conn, $userId, $deviceId);
            break;

        case 'sync':
        default:
            $result = handleSync($conn, $userId, $input, $source, $deviceId, $clientVersion);
            break;
    }

    echo json_encode($result, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Settings sync error for user " . ($_SESSION['user_id'] ?? 'unknown') . ": " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Sync operation failed',
        'code' => 'SYNC_FAILED',
        'timestamp' => time()
    ]);
}

/**
 * Handle settings export
 */
function handleExport($conn, $userId, $source, $deviceId, $clientVersion) {
    $stmt = $conn->prepare("
        SELECT 
            preferences_json,
            updated_at,
            version
        FROM user_preferences 
        WHERE user_id = ?
    ");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $settings = [];
    $metadata = [];
    
    if ($result->num_rows === 1) {
        $row = $result->fetch_assoc();
        if ($row['preferences_json']) {
            $settings = json_decode($row['preferences_json'], true);
            $metadata = [
                'server_version' => $row['version'],
                'last_modified' => strtotime($row['updated_at']),
                'checksum' => md5($row['preferences_json'])
            ];
        }
    }

    // Apply export filters (remove sensitive data)
    $settings = filterSettingsForExport($settings);
    
    // Add sync metadata
    $exportData = [
        'settings' => $settings,
        'metadata' => $metadata,
        'export_info' => [
            'export_date' => date('c'),
            'user_id' => $userId,
            'source' => $source,
            'device_id' => $deviceId,
            'client_version' => $clientVersion,
            'format_version' => '2.0'
        ]
    ];
    
    // Log export activity
    logUserActivity($userId, 'export_settings', [
        'source' => $source,
        'device_id' => $deviceId,
        'client_version' => $clientVersion,
        'settings_count' => count($settings)
    ]);

    // Record sync event
    recordSyncEvent($conn, $userId, 'export', $source, $deviceId, true);

    return [
        'success' => true,
        'action' => 'export',
        'data' => $exportData,
        'timestamp' => time()
    ];
}

/**
 * Handle settings import
 */
function handleImport($conn, $userId, $input, $source, $deviceId, $clientVersion) {
    if (!isset($input['data']['settings'])) {
        throw new Exception('No settings data provided for import');
    }
    
    $importedSettings = $input['data']['settings'];
    $importMetadata = $input['data']['metadata'] ?? [];
    $conflictResolution = $input['conflict_resolution'] ?? 'server'; // 'server', 'client', 'merge'
    
    // Get current server settings for conflict detection
    $currentSettings = getCurrentSettings($conn, $userId);
    $hasConflict = detectSettingsConflict($currentSettings, $importedSettings, $importMetadata);
    
    if ($hasConflict && $conflictResolution === 'server') {
        // Server wins - reject import
        return [
            'success' => false,
            'error' => 'Settings conflict detected. Server version is newer.',
            'code' => 'CONFLICT_DETECTED',
            'server_version' => $importMetadata['server_version'] ?? null,
            'conflict_timestamp' => $importMetadata['last_modified'] ?? null
        ];
    }
    
    // Resolve conflicts if needed
    if ($hasConflict && $conflictResolution === 'merge') {
        $importedSettings = mergeSettings($currentSettings, $importedSettings);
    }
    
    $validatedSettings = validatePreferences($importedSettings);
    $settingsJson = json_encode($validatedSettings, JSON_UNESCAPED_UNICODE);
    
    // Start transaction
    $conn->begin_transaction();
    
    try {
        $stmt = $conn->prepare("
            INSERT INTO user_preferences (user_id, preferences_json, updated_at, version) 
            VALUES (?, ?, NOW(), COALESCE((
                SELECT version + 1 FROM user_preferences WHERE user_id = ?
            ), 1))
            ON DUPLICATE KEY UPDATE 
            preferences_json = VALUES(preferences_json),
            updated_at = NOW(),
            version = version + 1
        ");
        $stmt->bind_param("isi", $userId, $settingsJson, $userId);
        $stmt->execute();
        
        $conn->commit();
        
        // Log import activity
        logUserActivity($userId, 'import_settings', [
            'source' => $source,
            'device_id' => $deviceId,
            'client_version' => $clientVersion,
            'settings_count' => count($validatedSettings),
            'conflict_resolved' => $hasConflict,
            'resolution_strategy' => $conflictResolution
        ]);

        // Record sync event
        recordSyncEvent($conn, $userId, 'import', $source, $deviceId, true);

        return [
            'success' => true,
            'action' => 'import',
            'message' => 'Settings imported successfully',
            'imported_count' => count($validatedSettings),
            'conflict_resolved' => $hasConflict,
            'timestamp' => time()
        ];
        
    } catch (Exception $e) {
        $conn->rollback();
        throw $e;
    }
}

/**
 * Handle two-way sync
 */
function handleSync($conn, $userId, $input, $source, $deviceId, $clientVersion) {
    $clientSettings = $input['settings'] ?? [];
    $clientMetadata = $input['metadata'] ?? [];
    $syncStrategy = $input['sync_strategy'] ?? 'server_wins';
    
    // Get server settings
    $serverSettings = getCurrentSettings($conn, $userId);
    $serverMetadata = getSettingsMetadata($conn, $userId);
    
    // Determine which version to keep
    $mergedSettings = resolveSync($serverSettings, $clientSettings, $serverMetadata, $clientMetadata, $syncStrategy);
    
    $validatedSettings = validatePreferences($mergedSettings);
    $settingsJson = json_encode($validatedSettings, JSON_UNESCAPED_UNICODE);
    
    // Save merged settings if different from server
    if ($mergedSettings !== $serverSettings) {
        $stmt = $conn->prepare("
            INSERT INTO user_preferences (user_id, preferences_json, updated_at, version) 
            VALUES (?, ?, NOW(), version + 1)
            ON DUPLICATE KEY UPDATE 
            preferences_json = VALUES(preferences_json),
            updated_at = NOW(),
            version = version + 1
        ");
        $stmt->bind_param("is", $userId, $settingsJson);
        $stmt->execute();
    }
    
    // Log sync activity
    logUserActivity($userId, 'sync_settings', [
        'source' => $source,
        'device_id' => $deviceId,
        'client_version' => $clientVersion,
        'sync_strategy' => $syncStrategy,
        'settings_merged' => $mergedSettings !== $serverSettings
    ]);

    // Record sync event
    recordSyncEvent($conn, $userId, 'sync', $source, $deviceId, true);

    return [
        'success' => true,
        'action' => 'sync',
        'settings' => $validatedSettings,
        'metadata' => getSettingsMetadata($conn, $userId),
        'sync_result' => [
            'strategy' => $syncStrategy,
            'merged' => $mergedSettings !== $serverSettings,
            'client_settings_count' => count($clientSettings),
            'server_settings_count' => count($serverSettings)
        ],
        'timestamp' => time()
    ];
}

/**
 * Handle sync status request
 */
function handleStatus($conn, $userId, $deviceId) {
    $stmt = $conn->prepare("
        SELECT 
            up.updated_at as last_sync,
            up.version,
            COUNT(uph.id) as history_count,
            MAX(uph.created_at) as last_backup
        FROM user_preferences up
        LEFT JOIN user_preferences_history uph ON up.user_id = uph.user_id
        WHERE up.user_id = ?
        GROUP BY up.user_id
    ");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    
    // Get recent sync events
    $eventsStmt = $conn->prepare("
        SELECT action, source, device_id, success, created_at
        FROM user_sync_events 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 10
    ");
    $eventsStmt->bind_param("i", $userId);
    $eventsStmt->execute();
    $eventsResult = $eventsStmt->get_result();
    $recentEvents = [];
    
    while ($event = $eventsResult->fetch_assoc()) {
        $recentEvents[] = $event;
    }
    
    return [
        'success' => true,
        'action' => 'status',
        'status' => [
            'last_sync' => $row['last_sync'],
            'current_version' => $row['version'],
            'backup_count' => $row['history_count'],
            'last_backup' => $row['last_backup'],
            'device_id' => $deviceId
        ],
        'recent_events' => $recentEvents,
        'timestamp' => time()
    ];
}

/**
 * Handle conflict resolution
 */
function handleConflictResolution($conn, $userId, $input, $source, $deviceId) {
    $clientSettings = $input['client_settings'] ?? [];
    $serverSettings = $input['server_settings'] ?? [];
    $resolution = $input['resolution'] ?? 'server'; // 'server', 'client', 'manual'
    
    $resolvedSettings = $serverSettings; // Default to server
    
    if ($resolution === 'client') {
        $resolvedSettings = $clientSettings;
    } elseif ($resolution === 'manual') {
        // Use manually merged settings
        $resolvedSettings = $input['merged_settings'] ?? $serverSettings;
    }
    
    $validatedSettings = validatePreferences($resolvedSettings);
    $settingsJson = json_encode($validatedSettings, JSON_UNESCAPED_UNICODE);
    
    $stmt = $conn->prepare("
        INSERT INTO user_preferences (user_id, preferences_json, updated_at, version) 
        VALUES (?, ?, NOW(), version + 1)
        ON DUPLICATE KEY UPDATE 
        preferences_json = VALUES(preferences_json),
        updated_at = NOW(),
        version = version + 1
    ");
    $stmt->bind_param("is", $userId, $settingsJson);
    $stmt->execute();
    
    // Log conflict resolution
    logUserActivity($userId, 'resolve_conflict', [
        'source' => $source,
        'device_id' => $deviceId,
        'resolution' => $resolution,
        'settings_count' => count($validatedSettings)
    ]);

    recordSyncEvent($conn, $userId, 'resolve_conflict', $source, $deviceId, true);

    return [
        'success' => true,
        'action' => 'resolve_conflict',
        'message' => 'Conflict resolved successfully',
        'resolution' => $resolution,
        'timestamp' => time()
    ];
}

/**
 * Record sync event for analytics
 */
function recordSyncEvent($conn, $userId, $action, $source, $deviceId, $success) {
    $stmt = $conn->prepare("
        INSERT INTO user_sync_events 
        (user_id, action, source, device_id, success, created_at) 
        VALUES (?, ?, ?, ?, ?, NOW())
    ");
    $successInt = $success ? 1 : 0;
    $stmt->bind_param("isssi", $userId, $action, $source, $deviceId, $successInt);
    $stmt->execute();
}

/**
 * Get current settings from database
 */
function getCurrentSettings($conn, $userId) {
    $stmt = $conn->prepare("SELECT preferences_json FROM user_preferences WHERE user_id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 1) {
        $row = $result->fetch_assoc();
        if ($row['preferences_json']) {
            return json_decode($row['preferences_json'], true) ?: [];
        }
    }
    
    return [];
}

/**
 * Get settings metadata
 */
function getSettingsMetadata($conn, $userId) {
    $stmt = $conn->prepare("SELECT version, updated_at FROM user_preferences WHERE user_id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 1) {
        $row = $result->fetch_assoc();
        return [
            'version' => $row['version'],
            'last_modified' => strtotime($row['updated_at'])
        ];
    }
    
    return ['version' => 0, 'last_modified' => 0];
}

/**
 * Detect settings conflict
 */
function detectSettingsConflict($serverSettings, $clientSettings, $clientMetadata) {
    $serverModified = $serverSettings['_metadata']['last_modified'] ?? 0;
    $clientModified = $clientMetadata['last_modified'] ?? 0;
    
    // Consider it a conflict if client has older version
    return $clientModified > 0 && $serverModified > $clientModified;
}

/**
 * Merge settings from server and client
 */
function mergeSettings($serverSettings, $clientSettings) {
    // Simple deep merge - client settings override server settings
    $merged = $serverSettings;
    
    foreach ($clientSettings as $key => $value) {
        if (is_array($value) && isset($merged[$key]) && is_array($merged[$key])) {
            $merged[$key] = array_merge($merged[$key], $value);
        } else {
            $merged[$key] = $value;
        }
    }
    
    return $merged;
}

/**
 * Resolve sync based on strategy
 */
function resolveSync($serverSettings, $clientSettings, $serverMetadata, $clientMetadata, $strategy) {
    switch ($strategy) {
        case 'client_wins':
            return $clientSettings;
        case 'server_wins':
            return $serverSettings;
        case 'newer_wins':
            $serverTime = $serverMetadata['last_modified'] ?? 0;
            $clientTime = $clientMetadata['last_modified'] ?? 0;
            return $clientTime > $serverTime ? $clientSettings : $serverSettings;
        case 'merge':
        default:
            return mergeSettings($serverSettings, $clientSettings);
    }
}

/**
 * Filter settings for export (remove sensitive data)
 */
function filterSettingsForExport($settings) {
    // Remove sensitive metadata
    unset($settings['_metadata']);
    
    // Remove any sensitive fields
    $sensitiveFields = ['password', 'token', 'api_key', 'secret'];
    foreach ($sensitiveFields as $field) {
        unset($settings[$field]);
    }
    
    return $settings;
}
?>