<?php
// session.php - Session management and validation

/**
 * Check if user is logged in and session is valid
 */
function validateSession() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    // Check if user is logged in
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['last_activity'])) {
        return false;
    }

    // Check session timeout (24 hours)
    $sessionTimeout = 24 * 60 * 60; // 24 hours in seconds
    if (time() - $_SESSION['last_activity'] > $sessionTimeout) {
        // Session expired
        session_unset();
        session_destroy();
        return false;
    }

    // Check for session hijacking
    if (isset($_SESSION['user_agent']) && $_SESSION['user_agent'] !== $_SERVER['HTTP_USER_AGENT']) {
        // Possible session hijacking
        session_unset();
        session_destroy();
        return false;
    }

    // Update last activity time
    $_SESSION['last_activity'] = time();

    return true;
}

/**
 * Get current user data
 */
function getCurrentUser() {
    if (!validateSession()) {
        return null;
    }

    try {
        require_once __DIR__ . '/../config/database.php';
        $conn = getDBConnection();
        
        $stmt = $conn->prepare("
            SELECT u.id, u.name, u.email, u.created_at, u.last_login, 
                   up.preferences_json 
            FROM users u 
            LEFT JOIN user_preferences up ON u.id = up.user_id 
            WHERE u.id = ? AND u.status = 'active'
        ");
        $stmt->bind_param("i", $_SESSION['user_id']);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 1) {
            $user = $result->fetch_assoc();
            
            // Parse preferences
            if ($user['preferences_json']) {
                $user['preferences'] = json_decode($user['preferences_json'], true);
            } else {
                $user['preferences'] = [];
            }
            
            return $user;
        }
    } catch (Exception $e) {
        error_log("Get current user error: " . $e->getMessage());
    }

    return null;
}

/**
 * Check if user has specific preference
 */
function getUserPreference($key, $default = null) {
    $user = getCurrentUser();
    if ($user && isset($user['preferences'][$key])) {
        return $user['preferences'][$key];
    }
    return $default;
}

/**
 * Update user preference
 */
function updateUserPreference($key, $value) {
    if (!validateSession()) {
        return false;
    }

    try {
        require_once __DIR__ . '/../config/database.php';
        $conn = getDBConnection();
        
        // Get current preferences
        $stmt = $conn->prepare("SELECT preferences_json FROM user_preferences WHERE user_id = ?");
        $stmt->bind_param("i", $_SESSION['user_id']);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 1) {
            $row = $result->fetch_assoc();
            $preferences = $row['preferences_json'] ? json_decode($row['preferences_json'], true) : [];
        } else {
            $preferences = [];
        }
        
        // Update preference
        $preferences[$key] = $value;
        $preferencesJson = json_encode($preferences);
        
        // Save to database
        $stmt = $conn->prepare("
            INSERT INTO user_preferences (user_id, preferences_json, updated_at) 
            VALUES (?, ?, NOW()) 
            ON DUPLICATE KEY UPDATE preferences_json = ?, updated_at = NOW()
        ");
        $stmt->bind_param("iss", $_SESSION['user_id'], $preferencesJson, $preferencesJson);
        
        return $stmt->execute();
        
    } catch (Exception $e) {
        error_log("Update preference error: " . $e->getMessage());
        return false;
    }
}

/**
 * Require authenticated user
 */
function requireAuth() {
    if (!validateSession()) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        exit;
    }
}

/**
 * Initialize session security
 */
function initSessionSecurity() {
    if (session_status() === PHP_SESSION_NONE) {
        // Session configuration
        ini_set('session.cookie_httponly', 1);
        ini_set('session.cookie_secure', 1); // Use only with HTTPS
        ini_set('session.use_strict_mode', 1);
        
        session_start();
    }

    // Set session security headers
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    
    // Initialize session variables if not set
    if (!isset($_SESSION['user_agent'])) {
        $_SESSION['user_agent'] = $_SERVER['HTTP_USER_AGENT'];
    }
    
    if (!isset($_SESSION['ip_address'])) {
        $_SESSION['ip_address'] = $_SERVER['REMOTE_ADDR'];
    }
    
    if (!isset($_SESSION['last_activity'])) {
        $_SESSION['last_activity'] = time();
    }
}

/**
 * Get session status for client-side
 */
function getSessionStatus() {
    if (validateSession()) {
        $user = getCurrentUser();
        return [
            'authenticated' => true,
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email']
            ],
            'preferences' => $user['preferences'] ?? []
        ];
    } else {
        return [
            'authenticated' => false,
            'user' => null,
            'preferences' => []
        ];
    }
}

// Initialize session security when this file is included
initSessionSecurity();
?>