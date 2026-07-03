<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configurações do Google Drive
$clientEmail = 'bot-backup@backup-ruth-dias.iam.gserviceaccount.com';
$privateKey = "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC7ERwWTCeoe/sK\nHgsL1B93+H7qocUrmQec3z3tUBaOFuz+4futT97ElZnae4d3kMFDjjMh9G6fNxG5\nWIlLPanOqJbK7Aweoo3VwV22m+DlZjp71hWDgj16edsNJPNTbjLhZ9CseLpSXwdO\nd1ve8RSGB/71r6b0tMkIGuh4oDwwtdMQ1AdRmHqiExA5Q9b4B2Ar3y9ber6jHaXW\n+qwT7ZmETFvr7Kkr5iUjFe+OnYbwhrAbnjtad46Ts0XlN80RwU65SdymR3yBudU6\nOI6CKzVpuMDpAY7AeMnofLp+9DbQ5cQGwUOT5XkIyHO7TSNxCqndfE1aS/A3FiXx\nEqAyadx/AgMBAAECggEATKt4DAl9bZgW7XAfzeLMXQLrnaXc5oALdzemLXgYLndl\n/hdH7CIipwa7rqjXfmFFXLdQ7Lc+iaHr8T/A0aY9zRYa66NwWjP8luHwU1IzDEJo\ncO3vFl3Qbby403vUANtXHjxK8g1vLCiHmZjg/hBn/YEUdcTe1EeuZ1SD+ECQOtPv\nFb8ASJ2Q0nwzkTi8/ILIxAUf8N8i1H3s6bw+S2IpeJ/kKCzLjVimUtB6vY4bF5ZY\nq50wUyGZfr2566IQlcd/efVQuBm1x7soowHuz4hmsFtoUr3J+ASzwVw1kIru6+u7\naBhHI8nuUofSEjM5YIXuZf4Rne5Pbi2P77BPF9ZDhQKBgQDqZvNKRrqEGmXiuSK6\n17iBZyzreh8nu9hUKnhZM+ER8IC7mq4u+66HbzuSkeBo8BxuS5IVr9WCfyDzNPbZ\nNtwlptz3XZswCGg1IS3PuasQFvDgQffuVk/rsohPTf/FLUTYJdr+4BlbfQJclGF8\n0zGDWrgyxC7/ke3FW5nsPxsI8wKBgQDMTZ6iEItFMPri0FArrFcmVh83S4ZHyaMn\nmVTu8cCvfAgobzzZox9b1M/l4aidfgVkFx6Q2wQ1Kf/R5+sFf3dUqUF9tGxeJjFF\nE+xeKAK9CSU+WjWZcKX/wOiFM/PJYCn15tcS/BPhdbzF7475LcwfaAhcomE5ZeXK\nL8kutGqBRQKBgF8I7Hzh3j8vIL3ih+UvDxxQA5NZSQZoD5ZYPcEU2pzWYKsvVI2x\n9xnsDEApqs2BBFXnh8wJJUyqVGamw6pfprQRSid0qTW5Qt6/m/5LbcKxOmoB9Q6J\nqg+Kq99TZW7BItdrybVqkH1aWrnEYx4j1kBGaMYUamWt+bP5ppd1InXnAoGAFNCP\nqelPlyQPW45nrJtpYaGCmqqaKrQzaDRp/9InlHlph10V8QJ6jmuXJs+f0zPkrrbg\nSVfXDOeThbpAKpY6/SglYP5B0DHJ8US/XzRqWwIUhk7AiTp93xmzVubdHpYqkEAN\nh4ShLeZF7lCi22Y8FrMNrwpoJ2XnTHsj3xtIgpUCgYAr0w4YlZp3GsTKFfF5CrLr\nGD6ipSmV8auq8ZTIwFPAydveJdPfKTRxbmmN1u5OdRWSD4MyVSunjwXh7/Dv2iY1\nMNJkut5FY0R1p3fwAX/mPvRP4bN5uyxtmtLoIXhH7iZinkr3WjVfU3DiPF8eH5DU\nHVZmVoqeP2zwOYuElxRreg==\n-----END PRIVATE KEY-----\n";
$folderId = '1xTtvvll861VRMkHTySb-4zaOXS-qRdqn';

// Configurações do Banco de Dados
$host = 'localhost';
$db   = 'u615291125_aplicativo';
$user = 'u615291125_aplicativo';
$pass = '|d1#bmN+U';
$dsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Conexão falhou", "details" => $e->getMessage()]);
    exit;
}

// 1. Extrair os dados do banco de dados
try {
    $stmt = $pdo->query("SELECT key_name, value FROM ruth_dias_storage");
    $data = [];
    while ($row = $stmt->fetch()) {
        $data[$row['key_name']] = $row['value'];
    }
    
    // Converte os dados em uma string JSON formatada
    $fileContent = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    $fileName = "backup_sistema_ruth_dias_" . date('Y-m-d_H-i-s') . ".json";
    
} catch (\Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Erro ao extrair dados", "details" => $e->getMessage()]);
    exit;
}

// 2. Gerar o Token de Acesso do Google (JWT JWT-Bearer)
$header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
$now = time();
$claim = json_encode([
    'iss' => $clientEmail,
    'scope' => 'https://www.googleapis.com/auth/drive',
    'aud' => 'https://oauth2.googleapis.com/token',
    'exp' => $now + 3600,
    'iat' => $now
]);

$base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
$base64UrlClaim = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($claim));
$signatureInput = $base64UrlHeader . "." . $base64UrlClaim;

if (!openssl_sign($signatureInput, $signature, $privateKey, "SHA256")) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Erro ao assinar JWT com a chave privada."]);
    exit;
}

$base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
$jwt = $signatureInput . "." . $base64UrlSignature;

// Faz a requisição para obter o Access Token
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/token');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
    'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    'assertion' => $jwt
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$tokenData = json_decode($response, true);

if ($httpcode !== 200 || !isset($tokenData['access_token'])) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Falha ao obter access token do Google", "details" => $tokenData]);
    exit;
}

$accessToken = $tokenData['access_token'];

// 3. Fazer o Upload do Arquivo para o Google Drive
$boundary = 'foo_bar_baz_' . md5(time());

$metadata = [
    'name' => $fileName,
    'parents' => [$folderId]
];

$postBody = "--$boundary\r\n";
$postBody .= "Content-Type: application/json; charset=UTF-8\r\n\r\n";
$postBody .= json_encode($metadata) . "\r\n";
$postBody .= "--$boundary\r\n";
$postBody .= "Content-Type: application/json\r\n\r\n";
$postBody .= $fileContent . "\r\n";
$postBody .= "--$boundary--";

$chUpload = curl_init();
curl_setopt($chUpload, CURLOPT_URL, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
curl_setopt($chUpload, CURLOPT_POST, true);
curl_setopt($chUpload, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $accessToken,
    'Content-Type: multipart/related; boundary=' . $boundary,
    'Content-Length: ' . strlen($postBody)
]);
curl_setopt($chUpload, CURLOPT_POSTFIELDS, $postBody);
curl_setopt($chUpload, CURLOPT_RETURNTRANSFER, true);
curl_setopt($chUpload, CURLOPT_SSL_VERIFYPEER, false);
$uploadResponse = curl_exec($chUpload);
$uploadHttpCode = curl_getinfo($chUpload, CURLINFO_HTTP_CODE);
curl_close($chUpload);

$uploadResult = json_decode($uploadResponse, true);

if ($uploadHttpCode === 200) {
    echo json_encode([
        "status" => "success", 
        "message" => "Backup realizado com sucesso no Google Drive!", 
        "file_id" => $uploadResult['id'],
        "file_name" => $fileName
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        "status" => "error", 
        "message" => "Falha ao fazer upload para o Google Drive", 
        "details" => $uploadResult
    ]);
}
