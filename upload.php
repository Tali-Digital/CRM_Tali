<?php
// Permitir chamadas do seu painel local e de outros domínios (CORS)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Se for uma requisição OPTIONS (Preflight do navegador), retorna sucesso
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

$response = ['success' => false, 'message' => 'Requisição inválida.'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Recebe o JSON enviado pelo React
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    
    if (isset($data['image'])) {
        $base64_string = $data['image'];
        
        // Remove a parte "data:image/jpeg;base64," se existir
        $parts = explode(',', $base64_string);
        $encodedData = count($parts) > 1 ? $parts[1] : $parts[0];
        
        // Decodifica a imagem
        $decodedData = base64_decode($encodedData);
        
        if ($decodedData === false) {
            $response['message'] = 'Falha ao decodificar a imagem.';
        } else {
            // Gera um nome único para o arquivo
            $filename = uniqid('img_') . '.jpg';
            $upload_dir = __DIR__ . '/uploads/';
            
            // Cria a pasta uploads se ela não existir
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0755, true);
            }
            
            $file_path = $upload_dir . $filename;
            
            // Salva a imagem no servidor
            if (file_put_contents($file_path, $decodedData)) {
                // Monta a URL pública da imagem
                $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http");
                $host = $_SERVER['HTTP_HOST'];
                $dir_path = dirname($_SERVER['PHP_SELF']);
                $dir_path = $dir_path == '/' ? '' : $dir_path;
                $dir_path = str_replace('\\', '/', $dir_path);
                
                $url = $protocol . "://" . $host . $dir_path . '/uploads/' . $filename;
                
                $response = ['success' => true, 'url' => $url];
            } else {
                $response['message'] = 'Falha ao salvar o arquivo na Hostinger. Verifique as permissões da pasta uploads.';
            }
        }
    } else {
        $response['message'] = 'Nenhuma imagem foi enviada no payload.';
    }
}

// Retorna a resposta em JSON
header('Content-Type: application/json');
echo json_encode($response);
?>
