<?php
// Validation and rate limiting functions

/**
 * Check rate limit for an action
 * @param string $action Action identifier
 * @param int $timeWindow Time window in seconds
 * @param int $maxRequests Maximum requests allowed in time window
 * @return bool Whether action is allowed
 */
function checkRateLimit($action, $timeWindow, $maxRequests) {
    // Using session-based rate limiting
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    $key = 'rate_limit_' . $action;
    $now = time();
    
    if (!isset($_SESSION[$key])) {
        $_SESSION[$key] = array();
    }
    
    // Remove old entries outside the time window
    $_SESSION[$key] = array_filter($_SESSION[$key], function($timestamp) use ($now, $timeWindow) {
        return ($now - $timestamp) < $timeWindow;
    });
    
    // Check if we've exceeded the limit
    if (count($_SESSION[$key]) >= $maxRequests) {
        return false;
    }
    
    // Record this request
    $_SESSION[$key][] = $now;
    return true;
}

/**
 * Validate required fields in array
 * @param array $data Data to validate
 * @param array $required Required field names
 * @return bool Whether all required fields are present and not empty
 */
function validateRequired($data, $required = array()) {
    foreach ($required as $field) {
        if (!isset($data[$field]) || empty($data[$field])) {
            return false;
        }
    }
    return true;
}

/**
 * Sanitize string input
 * @param string $input String to sanitize
 * @return string Sanitized string
 */
function sanitizeString($input) {
    return trim(strip_tags($input));
}
