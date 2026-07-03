# Plano de Implementação: Autenticação Segura (Senha e Google)

Atualmente, o sistema utiliza uma simulação de banco de dados na memória do navegador (`localStorage`) que apenas exige o e-mail. Para atendermos ao seu requisito crítico de **"não vazar senhas e garantir segurança real"**, não podemos salvar senhas no navegador. 

A solução padrão ouro da indústria para isso é integrar o **Firebase Authentication** (serviço oficial da Google).

## Por que Firebase?
- **Criptografia Militar:** As senhas nunca chegam a ficar salvas no nosso código, elas vão direto para os cofres da Google, já criptografadas.
- **Google Sign-In Nativo:** Permite adicionar o botão "Entrar com o Google" de forma nativa e extremamente segura.
- **Zero Vazamentos:** Como não guardamos senhas no banco de dados local, é impossível vazar senhas.

## Proposed Changes

### 1. Atualização do Motor de Autenticação (`AuthContext.tsx`)
- **[MODIFY]** `src/context/AuthContext.tsx`:
  - Removeremos a lógica frágil de `localStorage` para senhas.
  - Integraremos a biblioteca oficial do `firebase`.
  - O sistema passará a ouvir a sessão diretamente do servidor do Firebase (garantindo que se o usuário fechar a aba, a sessão continua segura e criptografada).

### 2. Atualização das Telas de Login
- **[MODIFY]** Tela de Login do Painel (`App.tsx` ou componente de Login):
  - Adicionar o campo "Senha" obrigatório.
  - Adicionar um botão destacado: **"Entrar com o Google"**.
- **[MODIFY]** `src/components/ClientLoginModal.tsx` (Login de clientes no Site):
  - Inserir campo de senha no momento de favoritar o imóvel.
  - Adicionar opção de "Cadastrar/Entrar com o Google" rápido para não perder o lead.

### 3. Página Meu Perfil
- **[MODIFY]** `src/pages/MyProfile.tsx`:
  - Adicionar botão de "Redefinir Senha" que enviará um e-mail automático (gerado pelo próprio Google) para o usuário trocar a senha com segurança.

## User Review Required

> [!CAUTION]
> **Ação Necessária da sua parte:**
> Como o Firebase é um serviço seguro da Google, eu (como Inteligência Artificial) não posso criar a conta por você.
> Para que eu possa implementar isso, você precisará acessar `firebase.google.com`, criar um projeto gratuito e me fornecer as **"Chaves de Configuração (Firebase Config)"**.
> 
> Você aprova seguirmos por este caminho (Firebase) para garantirmos a segurança nível Google? Se sim, me dê um "Ok" e eu posso te mandar o passo a passo curtinho de como pegar essas chaves!
