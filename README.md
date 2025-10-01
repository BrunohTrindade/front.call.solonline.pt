# Deploy do Frontend React

Este projeto utiliza Vite + React + Tailwind.

## Pré-requisitos
- Node.js >= 18
- npm ou yarn
- Acesso ao servidor VPS

## Configuração do ambiente

1. Edite o arquivo `.env` conforme necessário. Exemplo padrão para rodar na porta 8081:
   ```env
   VITE_PORT=8081
   VITE_PUBLIC_URL=http://89.117.58.152:8081
   # URL do backend (use sempre o caminho /api quando seu backend expõe a API nessa rota)
   # Preferencial: manter a API no mesmo origin via proxy reverso no Apache
   VITE_API_BASE=http://89.117.58.152:8081/api
   ```

## Passos para Deploy

1. **Clone o projeto no servidor VPS:**
   ```bash
   git clone <url-do-repositorio>
   cd front.call.solonline.pt
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   # ou
   yarn install
   ```

3. **Configure o arquivo `.env`:**
   - Ajuste as variáveis conforme necessário para o ambiente de produção.

4. **Build do projeto:**
   ```bash
   npm run build
   # ou
   yarn build
   ```
   - Os arquivos finais estarão na pasta `dist/`.

5. **Deploy rápido (rsync) para o servidor:**
   - Após o build, envie o conteúdo do `dist/` para o VPS (ajuste usuário/host/caminho):
     ```bash
     chmod +x deploy/rsync-deploy.sh
     ./deploy/rsync-deploy.sh <SSH_USER> <SSH_HOST> /var/www/solonline-front/dist
     ```

6. **Sirva o build em produção (Apache):**

    - O Apache pode retornar 404 em rotas SPA (por exemplo, `/login`) se não estiver com rewrite adequado. Recomendamos Nginx.
    
    - Exemplo de configuração Nginx (porta 8081):
       - Copie o build para o servidor (ex.: `/var/www/solonline-front/dist`).
       - Crie um arquivo `solonline-frontend.conf` em `/etc/nginx/sites-available/` com o conteúdo baseado em `deploy/nginx.conf.example` deste repositório. Ajuste a diretiva `root` para o caminho do seu `dist`.
       - Habilite o site e reinicie o Nginx:
          ```bash
          sudo ln -s /etc/nginx/sites-available/solonline-frontend.conf /etc/nginx/sites-enabled/
          sudo nginx -t
          sudo systemctl reload nginx
          ```
    - Bloco de servidor mínimo (referência):
       ```nginx
       server {
             listen 8081;
             server_name _;
             root /var/www/solonline-front/dist;
             index index.html;
             location / {
                   try_files $uri /index.html;
             }
             location = /robots.txt {
                   allow all;
                   log_not_found off;
                   access_log off;
             }
       }
       ```
    - Se o Apache já estiver escutando na porta 8081 (mensagem "Servidor Apache" em erro 404), você tem opções:
       - Parar/Desabilitar o Apache: `sudo systemctl disable --now apache2`
       - Ou mudar o Apache para outra porta e deixar o Nginx usar a 8081.
       - Após ajustar, recarregue o Nginx e teste em `http://SEU_IP:8081/` e em rotas como `/login`.

   - Exemplo de configuração Apache (porta 8081) — sem .htaccess:
     1. Garanta que o Apache escuta a 8081 (arquivo `/etc/apache2/ports.conf`):
        ```
        Listen 8081
        ```
     2. Publique o build em `/var/www/solonline-front/dist` (use o script rsync deste repo para facilitar).
     3. Crie o VirtualHost em `/etc/apache2/sites-available/solonline-frontend.conf` baseado em `deploy/apache.conf.example` (ajuste o `DocumentRoot`). O exemplo já inclui as regras de rewrite e cache no próprio VirtualHost (AllowOverride None).
      4. Habilite módulos e o site, e recarregue o Apache:
        ```bash
         sudo a2enmod rewrite expires proxy proxy_http
        sudo a2ensite solonline-frontend
        sudo apache2ctl configtest
        sudo systemctl reload apache2
        ```
   5. Teste: `http://SEU_IP:8081/` e `http://SEU_IP:8081/login` devem responder com o `index.html`.
   6. Usando domínio? Ajuste `VITE_PUBLIC_URL` no `.env` para `http(s)://seu-dominio[:porta]` e refaça o build antes de publicar.

7. **Deploy automatizado com rsync (opcional):**
   - Após `npm run build`, use o script:
     ```bash
     chmod +x deploy/rsync-deploy.sh
     ./deploy/rsync-deploy.sh <SSH_USER> <SSH_HOST> /var/www/solonline-front/dist
     ```
   - O script cria a pasta remota se necessário e sincroniza o conteúdo de `dist/` usando rsync.

8. **Servir com 'serve' + systemd (alternativa ao Nginx):**
   - Instale o `serve` no servidor (ou use npx):
     ```bash
     sudo npm i -g serve
     # ou apenas use npx no unit file
     ```
   - Copie o unit file de exemplo para o systemd e habilite:
     ```bash
     sudo cp deploy/solonline-frontend-serve.service /etc/systemd/system/
     sudo systemctl daemon-reload
     sudo systemctl enable --now solonline-frontend-serve
     ```
   - Ajuste `WorkingDirectory` no unit file para a pasta onde está o `dist` (ex.: `/var/www/solonline-front`).
## Dicas
- Certifique-se de liberar a porta 8081 no firewall do VPS.
- Para domínios, aponte o DNS para o IP do VPS e configure o proxy reverso se necessário.
 - Em SPA, as rotas do React (ex.: `/login`) devem sempre cair no `index.html` no servidor; o bloco `try_files $uri /index.html;` no Nginx resolve isso.

## Conexão com o backend (API)

- A URL da API é definida por `VITE_API_BASE` no `.env` (tempo de build). Agora está como `http://89.117.58.152:8081/api`, assumindo proxy reverso no Apache para o backend em 8080 (veja o exemplo em `deploy/apache.conf.example`).
- Qualquer mudança no `.env` requer novo build e republicação do `dist`.
- Com origin único (frontend+API em 8081), você evita CORS e simplifica a configuração.

## CI/CD automático (GitHub Actions)

Este repositório inclui um workflow em `.github/workflows/deploy.yml` que:
- roda a cada push na `main` (ou manualmente via `workflow_dispatch`)
- instala dependências, faz `npm run build`
- publica `dist/` no servidor VPS via `rsync` sobre SSH
- (opcional) recarrega o Apache

Configure no GitHub (Settings → Secrets and variables):
- Secrets
   - `SSH_PRIVATE_KEY`: chave privada com acesso ao VPS (use uma chave sem senha ou configure `ssh-agent` no servidor).
   - `SSH_HOST`: IP do VPS (ex.: `89.117.58.152`).
   - `SSH_USER`: usuário SSH (ex.: `ubuntu` ou `root`).
   - `SSH_PORT` (opcional): porta SSH (padrão `22`).
   - `REMOTE_PATH` (opcional): caminho remoto do `dist` (padrão `/var/www/solonline-front/dist`).
   - `ENABLE_APACHE_RELOAD` (opcional): `true` para recarregar o Apache após deploy.
- Variables (Repository variables)
   - `VITE_PUBLIC_URL`: `http://89.117.58.152:8081`
   - `VITE_API_BASE`: `http://89.117.58.152:8081/api`
   - `VITE_API_ORIGIN`: `http://89.117.58.152:8081`

Após configurar, qualquer commit na `main` dispara o build e deploy automaticamente para seu VPS.

### Troubleshooting: 405 Method Not Allowed no /api/login

Se aparecer erro 405 para `/api/login`, siga estes passos:

1) Verifique o método e URL no navegador (DevTools → Network):
   - Deve ser `POST http://SEU_IP:8081/api/login` com `Content-Type: application/json`.
   - Se estiver indo para `8080` direto (sem proxy), refaça o build com `VITE_API_BASE=http://SEU_IP:8081/api` e mantenha o proxy no Apache.

2) Valide o proxy do Apache (no servidor do front):
   ```bash
   curl -i http://127.0.0.1:8081/api/login -X POST \
     -H 'Content-Type: application/json' \
     -d '{"email":"test@example.com","password":"123"}'
   ```
   - Se retornar 405 aqui, o problema está no roteamento/proxy ou no backend.

3) Valide o backend diretamente (no servidor da API, porta 8080):
   ```bash
   curl -i http://127.0.0.1:8080/api/login -X POST \
     -H 'Content-Type: application/json' \
     -d '{"email":"test@example.com","password":"123"}'
   ```
   - Se também retornar 405, a rota POST `/api/login` pode não estar registrada ou o servidor 8080 não está roteando para o framework (ex.: Laravel sem rewrite para `public/index.php`).

4) Ajuste o ProxyPass/ProxyPassReverse com barras finais no `VirtualHost` (já no exemplo):
   ```apache
   ProxyPass        /api/ http://SEU_IP:8080/api/
   ProxyPassReverse /api/ http://SEU_IP:8080/api/
   ```
   - Após mudar, rode: `sudo systemctl reload apache2`.

5) Backend Laravel (exemplo):
   - Certifique-se de que o `DocumentRoot` aponta para `.../public` e que o rewrite para `index.php` está ativo (mod_rewrite habilitado).
   - A rota `POST /api/login` deve existir em `routes/api.php`.

## Por que ocorreu o erro 404 no /login?

- O erro que você viu mostra cabeçalho "Servidor Apache/2.4.41", indicando que quem respondeu foi o Apache na porta 8081, não o Nginx.
- Em SPAs, quando você acessa uma rota como `/login` diretamente, o servidor precisa redirecionar para `index.html` (fallback). No Apache, isso exige regras de rewrite (arquivo `.htaccess`) e VirtualHost corretos. Sem isso, o Apache tenta procurar um arquivo físico `/login` e retorna 404.
- Com Nginx, o fallback é resolvido pela diretiva `try_files $uri /index.html;` no `location /`, conforme o exemplo acima. Portanto, ao colocar o Nginx para escutar a 8081 e apontar `root` para o `dist`, a rota `/login` passa a funcionar normalmente.

