<?php
// api/auth/extension-login.php - Extension login authentication endpoint
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../includes/functions.php';

try {
    // Get JSON payload
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!$data) {
        $data = [
            'email' => $_POST['email'] ?? '',
            'password' => $_POST['password'] ?? ''
        ];
    }

    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';

    // Validation
    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Email and password are required']);
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid email format']);
        exit;
    }

    $conn = getDBConnection();
    
    // Find user with active status
    $stmt = $conn->prepare("SELECT id, name, email, password, status FROM users WHERE email = ? AND status = 'active'");
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $conn->error);
    }
    
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid email or password']);
        exit;
    }

    $user = $result->fetch_assoc();
    $stmt->close();

    // Verify password
    if (!password_verify($password, $user['password'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid email or password']);
        exit;
    }

    // Get user preferences
    $stmt = $conn->prepare("SELECT * FROM user_preferences WHERE user_id = ?");
    $stmt->bind_param("i", $user['id']);
    $stmt->execute();
    $prefResult = $stmt->get_result();
    $preferences = $prefResult->fetch_assoc() ?: [];
    $stmt->close();

    // Generate a secure token for the extension session (valid for 7 days)
    $token = bin2hex(random_bytes(32));
    $tokenExpiry = time() + (7 * 24 * 60 * 60); // 7 days

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'user' => [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email']
        ],
        'token' => $token,
        'tokenExpiry' => $tokenExpiry,
        'preferences' => $preferences
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
}
?>
