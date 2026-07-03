<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$host = 'localhost';
$db   = 'u615291125_aplicativo';
$user = 'u615291125_aplicativo';
$pass = '|d1#bmN+U';

$dsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
     $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
     http_response_code(500);
     echo json_encode(["status" => "error", "message" => "Conexão falhou", "details" => $e->getMessage()]);
     exit;
}

// Cria a tabela caso não exista
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS ruth_dias_storage (
        key_name VARCHAR(100) PRIMARY KEY,
        value LONGTEXT
    )");
} catch (\PDOException $e) {
    // Ignora erro de criação se usuário não tiver permissão de CREATE, 
    // assumindo que a tabela já existe
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $key = $_GET['key'] ?? '';
    if (!$key) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Key missing"]);
        exit;
    }
    
    $stmt = $pdo->prepare("SELECT value FROM ruth_dias_storage WHERE key_name = ?");
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    
    if ($row) {
        echo $row['value']; // O valor já é um JSON string
    } else {
        echo json_encode(null);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $key = $input['key'] ?? '';
    $value = $input['value'] ?? '';
    
    if (!$key || !$value) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Key or value missing"]);
        exit;
    }
    
    if (is_array($value)) {
        $value = json_encode($value, JSON_UNESCAPED_UNICODE);
    }

    $stmt = $pdo->prepare("INSERT INTO ruth_dias_storage (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?");
    $stmt->execute([$key, $value, $value]);
    
    if (isset($input['send_email']) && $input['send_email'] === true && isset($input['email_data'])) {
        $data = $input['email_data'];
        $to = "ruth.diasimoveis@gmail.com";
        $subject = "Nova Mensagem de Contato pelo Site";
        $message = "Você recebeu uma nova mensagem pelo site.\n\n";
        $message .= "Nome: " . ($data['name'] ?? '') . "\n";
        $message .= "E-mail: " . ($data['email'] ?? '') . "\n";
        $message .= "Telefone: " . ($data['phone'] ?? '') . "\n";
        $message .= "Mensagem:\n" . ($data['message'] ?? '') . "\n";
        $headers = "From: no-reply@ruthdiasimoveis.com.br\r\n";
        $headers .= "Reply-To: " . ($data['email'] ?? '') . "\r\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
        @mail($to, $subject, $message, $headers);
    }

    echo json_encode(["status" => "success"]);
}
